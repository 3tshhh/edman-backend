import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Session } from './entities/session.entity.js';
import { GpsAuditLog } from './entities/gps-audit-log.entity.js';
import { SessionPhoto } from './entities/session-photo.entity.js';
import { CampaignEnrollment } from '../campaigns/entities/campaign-enrollment.entity.js';
import { Volunteer } from '../volunteers/volunteer.entity.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';
import { CampaignStatus, SessionStatus } from '../../common/constants/enums.js';
import { isWithinProximity } from '../../common/utils/location.utils.js';
import { QuerySessionsDto } from './dto/query-sessions.dto.js';
import type { CampaignsService } from '../campaigns/campaigns.service.js';

interface GpsLogEntry {
  lat: number;
  lng: number;
  isWithinRange: boolean;
  isFirstArrival: boolean;
  timestamp: string;
}

interface SessionCtx {
  volunteerId: string;
  placeLat: number;
  placeLng: number;
  proximityThresholdMeters: number;
}

const SESSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private campaignsService: CampaignsService | null = null;

  setCampaignsService(campaignsService: CampaignsService): void {
    this.campaignsService = campaignsService;
  }

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(GpsAuditLog)
    private readonly gpsAuditLogRepository: Repository<GpsAuditLog>,
    @InjectRepository(SessionPhoto)
    private readonly sessionPhotoRepository: Repository<SessionPhoto>,
    @InjectRepository(CampaignEnrollment)
    private readonly enrollmentRepository: Repository<CampaignEnrollment>,
    @InjectRepository(Volunteer)
    private readonly volunteerRepository: Repository<Volunteer>,
    private readonly volunteersService: VolunteersService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findActive(userId: string): Promise<Session | null> {
    const volunteer = await this.volunteersService.findByUserId(userId);
    if (!volunteer) return null;

    return this.sessionRepository.findOne({
      where: [
        { volunteer: { id: volunteer.id }, status: SessionStatus.ACTIVE },
        {
          volunteer: { id: volunteer.id },
          status: SessionStatus.WAITING_ARRIVAL,
        },
      ],
      relations: ['campaign', 'campaign.place', 'volunteer'],
    });
  }

  async findHistory(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Session[]; total: number }> {
    const volunteer = await this.volunteersService.findByUserId(userId);
    if (!volunteer) return { data: [], total: 0 };

    const [data, total] = await this.sessionRepository.findAndCount({
      where: {
        volunteer: { id: volunteer.id },
        status: In([
          SessionStatus.COMPLETED,
          SessionStatus.LEFT_EARLY,
          SessionStatus.ABANDONED,
        ]),
      },
      relations: ['campaign', 'campaign.place'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async gpsPing(
    sessionId: string,
    userId: string,
    lat: number,
    lng: number,
  ): Promise<GpsAuditLog> {
    const session = await this.loadSessionForVolunteer(sessionId, userId);

    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('الجلسة ليست نشطة');
    }

    const place = session.campaign.place;
    const withinRange = isWithinProximity(
      lat,
      lng,
      Number(place.latitude),
      Number(place.longitude),
      place.proximityThresholdMeters,
    );

    const log = this.gpsAuditLogRepository.create({
      session: { id: sessionId },
      volunteer: { id: session.volunteer.id },
      latitude: lat,
      longitude: lng,
      isWithinRange: withinRange,
      isFirstArrival: false,
    });
    const savedLog = await this.gpsAuditLogRepository.save(log);

    session.lastLatitude = lat;
    session.lastLongitude = lng;
    session.gpsCheckCount += 1;
    await this.sessionRepository.save(session);

    return savedLog;
  }

  async confirmArrival(
    sessionId: string,
    volunteerId: string,
    coords: { lat: number; lng: number },
  ): Promise<Session> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, volunteer: { id: volunteerId } },
      relations: ['campaign', 'campaign.place', 'volunteer'],
    });

    if (!session) {
      throw new NotFoundException('الجلسة غير موجودة');
    }
    if (session.status !== SessionStatus.WAITING_ARRIVAL) {
      throw new BadRequestException('الجلسة ليست في حالة انتظار الوصول');
    }

    const place = session.campaign.place;
    const withinRange = isWithinProximity(
      coords.lat,
      coords.lng,
      Number(place.latitude),
      Number(place.longitude),
      place.proximityThresholdMeters,
    );

    if (!withinRange) {
      throw new BadRequestException('أنت خارج نطاق الموقع المطلوب');
    }

    session.status = SessionStatus.ACTIVE;
    session.startedAt = new Date();

    // Cache session context for zero-PG GPS pings
    const ctx: SessionCtx = {
      volunteerId,
      placeLat: Number(place.latitude),
      placeLng: Number(place.longitude),
      proximityThresholdMeters: place.proximityThresholdMeters,
    };
    await this.cacheManager.set(
      `session:ctx:${sessionId}`,
      JSON.stringify(ctx),
      SESSION_CACHE_TTL_MS,
    );

    // Init GPS log + ping count in Redis
    const firstEntry: GpsLogEntry = {
      lat: coords.lat,
      lng: coords.lng,
      isWithinRange: true,
      isFirstArrival: true,
      timestamp: new Date().toISOString(),
    };
    await this.cacheManager.set(
      `session:gpslog:${sessionId}`,
      JSON.stringify([firstEntry]),
      SESSION_CACHE_TTL_MS,
    );
    await this.cacheManager.set(`session:count:${sessionId}`, 1, SESSION_CACHE_TTL_MS);

    return this.sessionRepository.save(session);
  }

  async logGpsPing(
    sessionId: string,
    volunteerId: string,
    coords: { lat: number; lng: number },
  ): Promise<void> {
    const rawCtx = await this.cacheManager.get<string>(`session:ctx:${sessionId}`);
    if (!rawCtx) return; // session not active or ctx expired

    const ctx: SessionCtx = JSON.parse(rawCtx);

    const isWithinRange = isWithinProximity(
      coords.lat,
      coords.lng,
      ctx.placeLat,
      ctx.placeLng,
      ctx.proximityThresholdMeters,
    );

    // Append to Redis GPS log
    const logKey = `session:gpslog:${sessionId}`;
    const existing = (await this.cacheManager.get<string>(logKey)) ?? '[]';
    const log: GpsLogEntry[] = JSON.parse(existing);
    log.push({
      lat: coords.lat,
      lng: coords.lng,
      isWithinRange,
      isFirstArrival: false,
      timestamp: new Date().toISOString(),
    });
    await this.cacheManager.set(logKey, JSON.stringify(log), SESSION_CACHE_TTL_MS);

    // Increment ping count in Redis
    const countKey = `session:count:${sessionId}`;
    const count = (await this.cacheManager.get<number>(countKey)) ?? 0;
    await this.cacheManager.set(countKey, count + 1, SESSION_CACHE_TTL_MS);
  }

  async leaveEarly(
    sessionId: string,
    userId: string,
    reason: string,
  ): Promise<Session> {
    const session = await this.loadSessionForVolunteer(sessionId, userId);

    if (
      session.status !== SessionStatus.ACTIVE &&
      session.status !== SessionStatus.WAITING_ARRIVAL
    ) {
      throw new BadRequestException('لا يمكن مغادرة هذه الجلسة');
    }

    const now = new Date();
    session.status = SessionStatus.LEFT_EARLY;
    session.endReason = reason;
    session.endedAt = now;
    session.durationSeconds = session.startedAt
      ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    await this.flushSessionFromRedis(session);

    // Mirror to CampaignEnrollment
    await this.enrollmentRepository.update(
      {
        volunteer: { id: session.volunteer.id },
        campaign: { id: session.campaign.id },
      },
      { leaveReason: reason, leftAt: now },
    );

    const saved = await this.sessionRepository.save(session);
    await this.recalculateHours(session.volunteer.id);
    await this.checkCampaignCompletion(session.campaign.id);
    return saved;
  }

  async addPhoto(
    sessionId: string,
    userId: string,
    photoKey: string,
  ): Promise<SessionPhoto> {
    const session = await this.loadSessionForVolunteer(sessionId, userId);

    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('يمكن إضافة الصور فقط أثناء الجلسة النشطة');
    }

    const maxSeq = await this.sessionPhotoRepository
      .createQueryBuilder('photo')
      .where('photo.sessionId = :sessionId', { sessionId })
      .select('MAX(photo.sequenceNo)', 'max')
      .getRawOne();

    const sequenceNo = (maxSeq?.max ?? 0) + 1;

    const photo = this.sessionPhotoRepository.create({
      session: { id: sessionId },
      photoKey,
      sequenceNo,
    });
    return this.sessionPhotoRepository.save(photo);
  }

  async submitFeedback(
    sessionId: string,
    userId: string,
    text: string,
  ): Promise<Session> {
    const session = await this.loadSessionForVolunteer(sessionId, userId);

    if (
      session.status !== SessionStatus.COMPLETED &&
      session.status !== SessionStatus.LEFT_EARLY
    ) {
      throw new BadRequestException('يمكن تقديم التقييم فقط بعد انتهاء الجلسة');
    }

    session.feedback = text;
    session.feedbackAt = new Date();
    return this.sessionRepository.save(session);
  }

  async abandon(sessionId: string, reason: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['volunteer', 'campaign'],
    });
    if (!session) {
      throw new NotFoundException('الجلسة غير موجودة');
    }

    if (
      session.status !== SessionStatus.ACTIVE &&
      session.status !== SessionStatus.WAITING_ARRIVAL
    ) {
      throw new BadRequestException('لا يمكن إلغاء هذه الجلسة');
    }

    const now = new Date();
    session.status = SessionStatus.ABANDONED;
    session.endReason = reason;
    session.endedAt = now;
    session.durationSeconds = session.startedAt
      ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    await this.flushSessionFromRedis(session);

    const saved = await this.sessionRepository.save(session);
    await this.recalculateHours(session.volunteer.id);
    await this.checkCampaignCompletion(session.campaign.id);
    return saved;
  }

  async findAll(
    query: QuerySessionsDto,
  ): Promise<{ data: Session[]; total: number }> {
    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.volunteer', 'volunteer')
      .leftJoinAndSelect('volunteer.user', 'user')
      .leftJoinAndSelect('session.campaign', 'campaign')
      .leftJoinAndSelect('campaign.place', 'place');

    if (query.volunteerId) {
      qb.andWhere('volunteer.id = :volunteerId', {
        volunteerId: query.volunteerId,
      });
    }
    if (query.campaignId) {
      qb.andWhere('campaign.id = :campaignId', {
        campaignId: query.campaignId,
      });
    }
    if (query.status) {
      qb.andWhere('session.status = :status', { status: query.status });
    }
    if (query.group) {
      qb.andWhere('volunteer.volunteerGroup = :group', { group: query.group });
    }

    qb.orderBy('session.createdAt', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async autoComplete(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['volunteer', 'campaign'],
    });
    if (!session || session.status !== SessionStatus.ACTIVE) return;

    const now = new Date();
    session.status = SessionStatus.COMPLETED;
    session.endedAt = now;
    session.durationSeconds = session.startedAt
      ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    await this.flushSessionFromRedis(session);

    await this.sessionRepository.save(session);
    await this.recalculateHours(session.volunteer.id);
    await this.checkCampaignCompletion(session.campaign.id);
  }

  @Cron('*/1 * * * *')
  async checkAutoComplete(): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm

    const activeSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.campaign', 'campaign')
      .where('session.status = :status', { status: SessionStatus.ACTIVE })
      .andWhere(
        '(campaign.scheduledDate < :today OR (campaign.scheduledDate = :today AND campaign.endTime <= :currentTime))',
        { today, currentTime },
      )
      .getMany();

    for (const session of activeSessions) {
      try {
        await this.autoComplete(session.id);
        this.logger.log(`Auto-completed session ${session.id}`);
      } catch (err) {
        this.logger.error(`Failed to auto-complete session ${session.id}`, err);
      }
    }
  }

  async hasActiveSessionsForCampaign(campaignId: string): Promise<boolean> {
    const count = await this.sessionRepository.count({
      where: [
        { campaign: { id: campaignId }, status: SessionStatus.ACTIVE },
        { campaign: { id: campaignId }, status: SessionStatus.WAITING_ARRIVAL },
      ],
    });
    return count > 0;
  }

  async hasActiveSessionsForPlace(placeId: string): Promise<boolean> {
    const count = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.campaign', 'campaign')
      .where('campaign.placeId = :placeId', { placeId })
      .andWhere('session.status IN (:...statuses)', {
        statuses: [SessionStatus.ACTIVE, SessionStatus.WAITING_ARRIVAL],
      })
      .getCount();
    return count > 0;
  }

  // Used by VolunteersService for history
  async findSessionsForVolunteer(
    volunteerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Session[]; total: number }> {
    const [data, total] = await this.sessionRepository.findAndCount({
      where: {
        volunteer: { id: volunteerId },
        status: In([
          SessionStatus.COMPLETED,
          SessionStatus.LEFT_EARLY,
          SessionStatus.ABANDONED,
        ]),
      },
      relations: ['campaign', 'campaign.place'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  // Used by location gateway to find current session for a volunteer
  async findActiveSessionForVolunteer(
    volunteerId: string,
  ): Promise<Session | null> {
    return this.sessionRepository.findOne({
      where: [
        { volunteer: { id: volunteerId }, status: SessionStatus.ACTIVE },
        {
          volunteer: { id: volunteerId },
          status: SessionStatus.WAITING_ARRIVAL,
        },
      ],
      relations: ['campaign', 'campaign.place', 'volunteer'],
    });
  }

  private async flushSessionFromRedis(session: Session): Promise<void> {
    const sessionId = session.id;
    const volunteerId = session.volunteer.id;

    // Flush GPS log from Redis → PG (bulk insert)
    const logKey = `session:gpslog:${sessionId}`;
    const rawLog = await this.cacheManager.get<string>(logKey);
    if (rawLog) {
      const entries: GpsLogEntry[] = JSON.parse(rawLog);
      if (entries.length > 0) {
        const logs = entries.map((e) =>
          this.gpsAuditLogRepository.create({
            session: { id: sessionId },
            volunteer: { id: volunteerId },
            latitude: e.lat,
            longitude: e.lng,
            isWithinRange: e.isWithinRange,
            isFirstArrival: e.isFirstArrival,
          }),
        );
        await this.gpsAuditLogRepository.save(logs);
      }
    }

    // Flush ping count → session.gpsCheckCount
    const count = await this.cacheManager.get<number>(`session:count:${sessionId}`);
    if (count !== null && count !== undefined) {
      session.gpsCheckCount = count;
    }

    // Flush last known location → session.lastLatitude/lastLongitude
    const rawLoc = await this.cacheManager.get<string>(`location:${volunteerId}`);
    if (rawLoc) {
      const loc = JSON.parse(rawLoc);
      session.lastLatitude = loc.lat;
      session.lastLongitude = loc.lng;
    }

    // Clean up Redis session keys
    await Promise.all([
      this.cacheManager.del(`session:ctx:${sessionId}`),
      this.cacheManager.del(`session:count:${sessionId}`),
      this.cacheManager.del(logKey),
    ]);
  }

  private async loadSessionForVolunteer(
    sessionId: string,
    userId: string,
  ): Promise<Session> {
    const volunteer = await this.volunteersService.findByUserId(userId);
    if (!volunteer) {
      throw new ForbiddenException('لم يتم العثور على ملف المتطوع');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, volunteer: { id: volunteer.id } },
      relations: ['campaign', 'campaign.place', 'volunteer'],
    });
    if (!session) {
      throw new NotFoundException('الجلسة غير موجودة');
    }

    return session;
  }

  private async recalculateHours(volunteerId: string): Promise<void> {
    const result = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.volunteerId = :volunteerId', { volunteerId })
      .andWhere('session.status = :status', {
        status: SessionStatus.COMPLETED,
      })
      .select('COALESCE(SUM(session.durationSeconds), 0)', 'totalSeconds')
      .getRawOne();

    const totalHours = Number(result?.totalSeconds ?? 0) / 3600;
    await this.volunteerRepository.update(volunteerId, {
      totalVolunteeringHours: Math.round(totalHours * 100) / 100,
    });
  }

  /** Auto-complete campaign if no active/waiting sessions remain. */
  private async checkCampaignCompletion(campaignId: string): Promise<void> {
    if (!this.campaignsService) return;
    const hasRemaining = await this.hasActiveSessionsForCampaign(campaignId);
    if (!hasRemaining) {
      await this.campaignsService.updateStatus(
        campaignId,
        CampaignStatus.COMPLETED,
      );
    }
  }
}
