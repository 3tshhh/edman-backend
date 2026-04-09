import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Volunteer } from './volunteer.entity.js';
import { ApplyVolunteerDto } from './dto/apply-volunteer.dto.js';
import { ApproveVolunteerDto } from './dto/approve-volunteer.dto.js';
import { RejectVolunteerDto } from './dto/reject-volunteer.dto.js';
import { ChangeGroupDto } from './dto/change-group.dto.js';
import { QueryVolunteersDto } from './dto/query-volunteers.dto.js';
import { UserService } from '../user/user.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { SessionsService } from '../sessions/sessions.service.js';
import { ApplicationStatus, UserRole } from '../../common/constants/enums.js';

@Injectable()
export class VolunteersService {
  private sessionsService: SessionsService | null = null;

  constructor(
    @InjectRepository(Volunteer)
    private readonly volunteerRepository: Repository<Volunteer>,
    private readonly userService: UserService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  setSessionsService(sessionsService: SessionsService): void {
    this.sessionsService = sessionsService;
  }

  async apply(userId: string, dto: ApplyVolunteerDto): Promise<Volunteer> {
    const existing = await this.volunteerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (existing) {
      throw new ConflictException('لقد قمت بتقديم طلب بالفعل');
    }

    const nationalIdExists = await this.volunteerRepository.findOne({
      where: { nationalId: dto.nationalId },
    });
    if (nationalIdExists) {
      throw new ConflictException('رقم الهوية مستخدم بالفعل');
    }
    console.log(dto.area);
    
    const volunteer = this.volunteerRepository.create({
      ...dto,
      user: { id: userId },
    });
    return this.volunteerRepository.save(volunteer);
  }

  async getMyProfile(userId: string): Promise<object> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!volunteer) {
      throw new NotFoundException('لم يتم العثور على ملف المتطوع');
    }

    let totalCompletedCampaigns = 0;
    let totalVisitedPlaces = 0;

    if (this.sessionsService) {
      const { data: sessions } =
        await this.sessionsService.findSessionsForVolunteer(
          volunteer.id,
          1,
          1000,
        );

      const campaignIds = new Set<string>();
      const placeIds = new Set<string>();

      for (const session of sessions) {
        if (session.campaign) {
          campaignIds.add(session.campaign.id);
          if (session.campaign.place) {
            placeIds.add(session.campaign.place.id);
          }
        }
      }

      totalCompletedCampaigns = campaignIds.size;
      totalVisitedPlaces = placeIds.size;
    }

    return {
      ...volunteer,
      totalCompletedCampaigns,
      totalVisitedPlaces,
    };
  }

  async getMyHistory(
    userId: string,
    page: number,
    limit: number,
  ): Promise<object> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!volunteer) {
      throw new NotFoundException('لم يتم العثور على ملف المتطوع');
    }

    if (!this.sessionsService) {
      return {
        sessions: [],
        total: 0,
        totalVolunteeringHours: volunteer.totalVolunteeringHours,
      };
    }

    const { data, total } = await this.sessionsService.findSessionsForVolunteer(
      volunteer.id,
      page,
      limit,
    );

    return {
      sessions: data,
      total,
      totalVolunteeringHours: volunteer.totalVolunteeringHours,
    };
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userService.updateFcmToken(userId, fcmToken);
  }

  async findAll(
    query: QueryVolunteersDto,
  ): Promise<{ data: Volunteer[]; total: number }> {
    const qb = this.volunteerRepository
      .createQueryBuilder('volunteer')
      .leftJoinAndSelect('volunteer.user', 'user');

    if (query.group) {
      qb.andWhere('volunteer.volunteerGroup = :group', {
        group: query.group,
      });
    }

    qb.orderBy('volunteer.appliedAt', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findApplications(
    query: QueryVolunteersDto,
  ): Promise<{ data: Volunteer[]; total: number }> {
    const qb = this.volunteerRepository
      .createQueryBuilder('volunteer')
      .leftJoinAndSelect('volunteer.user', 'user');

    const status = query.status ?? ApplicationStatus.PENDING;
    qb.andWhere('volunteer.applicationStatus = :status', { status });

    if (query.group) {
      qb.andWhere('volunteer.volunteerGroup = :group', {
        group: query.group,
      });
    }

    qb.orderBy('volunteer.appliedAt', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async approve(
    volunteerId: string,
    dto: ApproveVolunteerDto,
    adminUserId: string,
  ): Promise<Volunteer> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { id: volunteerId },
    });
    if (!volunteer) {
      throw new NotFoundException('المتطوع غير موجود');
    }
    if (volunteer.applicationStatus !== ApplicationStatus.PENDING) {
      throw new BadRequestException('لا يمكن الموافقة على هذا الطلب');
    }

    volunteer.applicationStatus = ApplicationStatus.APPROVED;
    volunteer.volunteerGroup = dto.volunteerGroup;
    volunteer.reviewedAt = new Date();
    volunteer.reviewedBy = { id: adminUserId } as any;

    await this.userService.setRole(volunteer.user.id, UserRole.VOLUNTEER);

    const saved = await this.volunteerRepository.save(volunteer);

    // Send FCM push + in-app notification
    await this.notificationsService.sendApplicationResult(
      volunteer.user.id,
      volunteer.user.fcmToken,
      'approved',
      { volunteerGroup: dto.volunteerGroup },
    );

    // Subscribe volunteer to FCM group topic
    if (volunteer.user.fcmToken) {
      await this.notificationsService.subscribeToGroupTopic(
        volunteer.user.fcmToken,
        dto.volunteerGroup,
      );
    }

    return saved;
  }

  async reject(
    volunteerId: string,
    dto: RejectVolunteerDto,
    adminUserId: string,
  ): Promise<Volunteer> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { id: volunteerId },
    });
    if (!volunteer) {
      throw new NotFoundException('المتطوع غير موجود');
    }
    if (volunteer.applicationStatus !== ApplicationStatus.PENDING) {
      throw new BadRequestException('لا يمكن رفض هذا الطلب');
    }

    volunteer.applicationStatus = ApplicationStatus.REJECTED;
    volunteer.rejectionReason = dto.reason;
    volunteer.reviewedAt = new Date();
    volunteer.reviewedBy = { id: adminUserId } as any;

    const saved = await this.volunteerRepository.save(volunteer);

    // Send FCM push + in-app notification
    await this.notificationsService.sendApplicationResult(
      volunteer.user.id,
      volunteer.user.fcmToken,
      'rejected',
      { reason: dto.reason },
    );

    return saved;
  }

  async changeGroup(
    volunteerId: string,
    dto: ChangeGroupDto,
  ): Promise<Volunteer> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { id: volunteerId },
    });
    if (!volunteer) {
      throw new NotFoundException('المتطوع غير موجود');
    }
    if (volunteer.applicationStatus !== ApplicationStatus.APPROVED) {
      throw new BadRequestException(
        'لا يمكن تغيير المجموعة إلا للمتطوعين المعتمدين',
      );
    }

    volunteer.volunteerGroup = dto.volunteerGroup;

    // Re-subscribe to new group topic
    if (volunteer.user.fcmToken) {
      await this.notificationsService.subscribeToGroupTopic(
        volunteer.user.fcmToken,
        dto.volunteerGroup,
      );
    }

    return this.volunteerRepository.save(volunteer);
  }

  async ban(volunteerId: string): Promise<Volunteer> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { id: volunteerId },
    });
    if (!volunteer) {
      throw new NotFoundException('المتطوع غير موجود');
    }

    volunteer.applicationStatus = ApplicationStatus.BANNED;
    const saved = await this.volunteerRepository.save(volunteer);

    // Send FCM push + in-app notification
    await this.notificationsService.sendApplicationResult(
      volunteer.user.id,
      volunteer.user.fcmToken,
      'banned',
    );

    return saved;
  }

  async updateHours(volunteerId: string, hours: number): Promise<void> {
    await this.volunteerRepository.update(volunteerId, {
      totalVolunteeringHours: hours,
    });
  }

  async confirmRules(
    volunteerId: string,
    currentVersion: number,
  ): Promise<void> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { id: volunteerId },
    });
    if (!volunteer) {
      throw new NotFoundException('المتطوع غير موجود');
    }

    volunteer.rulesConfirmedVersion = currentVersion;
    await this.volunteerRepository.save(volunteer);
  }

  async findById(volunteerId: string): Promise<Volunteer> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { id: volunteerId },
      relations: ['user'],
    });
    if (!volunteer) {
      throw new NotFoundException('المتطوع غير موجود');
    }
    return volunteer;
  }

  async findByUserId(userId: string): Promise<Volunteer | null> {
    return this.volunteerRepository.findOne({
      where: { user: { id: userId } },
    });
  }
}
