import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Session } from './entities/session.entity.js';
import { GpsAuditLog } from './entities/gps-audit-log.entity.js';
import { SessionPhoto } from './entities/session-photo.entity.js';
import { TaskEnrollment } from '../tasks/entities/task-enrollment.entity.js';
import { Volunteer } from '../volunteers/volunteer.entity.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';
import { SessionStatus } from '../../common/constants/enums.js';
import { isWithinProximity } from '../../common/utils/location.utils.js';
import { QuerySessionsDto } from './dto/query-sessions.dto.js';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(GpsAuditLog)
    private readonly gpsAuditLogRepository: Repository<GpsAuditLog>,
    @InjectRepository(SessionPhoto)
    private readonly sessionPhotoRepository: Repository<SessionPhoto>,
    @InjectRepository(TaskEnrollment)
    private readonly enrollmentRepository: Repository<TaskEnrollment>,
    @InjectRepository(Volunteer)
    private readonly volunteerRepository: Repository<Volunteer>,
    private readonly volunteersService: VolunteersService,
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
      relations: ['task', 'task.place', 'volunteer'],
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
      relations: ['task', 'task.place'],
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

    const place = session.task.place;
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
      relations: ['task', 'task.place', 'volunteer'],
    });

    if (!session) {
      throw new NotFoundException('الجلسة غير موجودة');
    }
    if (session.status !== SessionStatus.WAITING_ARRIVAL) {
      throw new BadRequestException('الجلسة ليست في حالة انتظار الوصول');
    }

    const place = session.task.place;
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
    session.lastLatitude = coords.lat;
    session.lastLongitude = coords.lng;
    session.gpsCheckCount += 1;

    const log = this.gpsAuditLogRepository.create({
      session: { id: sessionId },
      volunteer: { id: volunteerId },
      latitude: coords.lat,
      longitude: coords.lng,
      isWithinRange: true,
      isFirstArrival: true,
    });
    await this.gpsAuditLogRepository.save(log);

    return this.sessionRepository.save(session);
  }

  async logGpsPing(
    sessionId: string,
    volunteerId: string,
    coords: { lat: number; lng: number },
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, volunteer: { id: volunteerId } },
      relations: ['task', 'task.place'],
    });

    if (!session || session.status !== SessionStatus.ACTIVE) return;

    const place = session.task.place;
    const withinRange = isWithinProximity(
      coords.lat,
      coords.lng,
      Number(place.latitude),
      Number(place.longitude),
      place.proximityThresholdMeters,
    );

    const log = this.gpsAuditLogRepository.create({
      session: { id: sessionId },
      volunteer: { id: volunteerId },
      latitude: coords.lat,
      longitude: coords.lng,
      isWithinRange: withinRange,
      isFirstArrival: false,
    });
    await this.gpsAuditLogRepository.save(log);

    session.lastLatitude = coords.lat;
    session.lastLongitude = coords.lng;
    session.gpsCheckCount += 1;
    await this.sessionRepository.save(session);
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

    // Mirror to TaskEnrollment
    await this.enrollmentRepository.update(
      {
        volunteer: { id: session.volunteer.id },
        task: { id: session.task.id },
      },
      { leaveReason: reason, leftAt: now },
    );

    const saved = await this.sessionRepository.save(session);
    await this.recalculateHours(session.volunteer.id);
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
      relations: ['volunteer', 'task'],
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

    const saved = await this.sessionRepository.save(session);
    await this.recalculateHours(session.volunteer.id);
    return saved;
  }

  async findAll(
    query: QuerySessionsDto,
  ): Promise<{ data: Session[]; total: number }> {
    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.volunteer', 'volunteer')
      .leftJoinAndSelect('volunteer.user', 'user')
      .leftJoinAndSelect('session.task', 'task')
      .leftJoinAndSelect('task.place', 'place');

    if (query.volunteerId) {
      qb.andWhere('volunteer.id = :volunteerId', {
        volunteerId: query.volunteerId,
      });
    }
    if (query.taskId) {
      qb.andWhere('task.id = :taskId', { taskId: query.taskId });
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
      relations: ['volunteer'],
    });
    if (!session || session.status !== SessionStatus.ACTIVE) return;

    const now = new Date();
    session.status = SessionStatus.COMPLETED;
    session.endedAt = now;
    session.durationSeconds = session.startedAt
      ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    await this.sessionRepository.save(session);
    await this.recalculateHours(session.volunteer.id);
  }

  @Cron('*/1 * * * *')
  async checkAutoComplete(): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm

    const activeSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.task', 'task')
      .where('session.status = :status', { status: SessionStatus.ACTIVE })
      .andWhere(
        '(task.scheduledDate < :today OR (task.scheduledDate = :today AND task.endTime <= :currentTime))',
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

  async hasActiveSessionsForTask(taskId: string): Promise<boolean> {
    const count = await this.sessionRepository.count({
      where: [
        { task: { id: taskId }, status: SessionStatus.ACTIVE },
        { task: { id: taskId }, status: SessionStatus.WAITING_ARRIVAL },
      ],
    });
    return count > 0;
  }

  async hasActiveSessionsForPlace(placeId: string): Promise<boolean> {
    const count = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.task', 'task')
      .where('task.placeId = :placeId', { placeId })
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
      relations: ['task', 'task.place'],
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
      relations: ['task', 'task.place', 'volunteer'],
    });
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
      relations: ['task', 'task.place', 'volunteer'],
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
}
