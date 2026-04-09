import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity.js';
import { CampaignEnrollment } from './entities/campaign-enrollment.entity.js';
import { Session } from '../sessions/entities/session.entity.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';
import { QueryCampaignsDto } from './dto/query-campaigns.dto.js';
import { PlacesService } from '../places/places.service.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';
import { RulesService } from '../rules/rules.service.js';
import type { SessionsService } from '../sessions/sessions.service.js';
import {
  SessionStatus,
  CampaignStatus,
  VolunteerGroup,
} from '../../common/constants/enums.js';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignEnrollment)
    private readonly enrollmentRepository: Repository<CampaignEnrollment>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly dataSource: DataSource,
    private readonly placesService: PlacesService,
    private readonly volunteersService: VolunteersService,
    private readonly rulesService: RulesService,
  ) {}

  private sessionsService: SessionsService | null = null;

  setSessionsService(sessionsService: SessionsService): void {
    this.sessionsService = sessionsService;
  }

  async findAll(
    query: QueryCampaignsDto,
  ): Promise<{ data: Campaign[]; total: number }> {
    const qb = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.place', 'place')
      .leftJoinAndSelect('campaign.createdBy', 'createdBy');

    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim());
      if (statuses.length === 1) {
        qb.andWhere('campaign.status = :status', { status: statuses[0] });
      } else {
        qb.andWhere('campaign.status IN (:...statuses)', { statuses });
      }
    }

    if (query.group) {
      qb.andWhere('campaign.volunteerGroup = :group', { group: query.group });
    }

    qb.orderBy('campaign.scheduledDate', 'DESC').addOrderBy(
      'campaign.startTime',
      'ASC',
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findMine(
    volunteerGroup: VolunteerGroup,
    volunteerId: string,
  ): Promise<Campaign[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.place', 'place')
      .where('campaign.volunteerGroup = :group', { group: volunteerGroup })
      .andWhere('campaign.scheduledDate >= :today', { today })
      .andWhere('campaign.status NOT IN (:...excluded)', {
        excluded: [CampaignStatus.CANCELLED, CampaignStatus.COMPLETED],
      })
      .andWhere(
        `campaign.id NOT IN (
          SELECT e."campaignId"
          FROM campaign_enrollments e
          WHERE e."volunteerId" = :volunteerId
        )`,
        { volunteerId },
      )
      .orderBy('campaign.scheduledDate', 'ASC')
      .addOrderBy('campaign.startTime', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('الحملة غير موجودة');
    }
    return campaign;
  }

  async enroll(
    campaignId: string,
    userId: string,
  ): Promise<{ enrollmentId: string; sessionId: string }> {
    // 1. Rules check
    const rules = await this.rulesService.getLatest();
    const volunteer = await this.volunteersService.findByUserId(userId);
    if (!volunteer) {
      throw new NotFoundException('لم يتم العثور على ملف المتطوع');
    }

    if (rules && volunteer.rulesConfirmedVersion < rules.version) {
      throw new ForbiddenException('يجب قراءة القوانين وتأكيدها أولاً');
    }

    // 2. Campaign validation
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('الحملة غير موجودة');
    }
    if (campaign.status !== CampaignStatus.OPEN) {
      throw new BadRequestException('هذه الحملة غير متاحة للتسجيل');
    }

    // 3. Check not already enrolled
    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        volunteer: { id: volunteer.id },
        campaign: { id: campaignId },
      },
    });
    if (existingEnrollment) {
      throw new ConflictException('أنت مسجل بالفعل في هذه الحملة');
    }

    // 4. Check no active session
    const activeSession = await this.sessionRepository.findOne({
      where: [
        { volunteer: { id: volunteer.id }, status: SessionStatus.ACTIVE },
        {
          volunteer: { id: volunteer.id },
          status: SessionStatus.WAITING_ARRIVAL,
        },
      ],
    });
    if (activeSession) {
      throw new ConflictException('لديك جلسة نشطة بالفعل');
    }

    // 5. Atomic transaction: enrollment + session + status update
    return this.dataSource.transaction(async (manager) => {
      const enrollment = manager.create(CampaignEnrollment, {
        volunteer: { id: volunteer.id },
        campaign: { id: campaignId },
      });
      const savedEnrollment = await manager.save(CampaignEnrollment, enrollment);

      const session = manager.create(Session, {
        volunteer: { id: volunteer.id },
        campaign: { id: campaignId },
        status: SessionStatus.WAITING_ARRIVAL,
      });
      const savedSession = await manager.save(Session, session);

      // Check if campaign is now full
      const enrollmentCount = await manager.count(CampaignEnrollment, {
        where: { campaign: { id: campaignId } },
      });
      if (enrollmentCount >= campaign.maxVolunteers) {
        await manager.update(Campaign, campaignId, {
          status: CampaignStatus.FULL,
        });
      }

      return {
        enrollmentId: savedEnrollment.id,
        sessionId: savedSession.id,
      };
    });
  }

  async create(dto: CreateCampaignDto, adminUserId: string): Promise<Campaign> {
    const place = await this.placesService.findById(dto.placeId);

    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
    }

    const campaign = this.campaignRepository.create({
      title: dto.title,
      description: dto.description,
      place,
      volunteerGroup: dto.volunteerGroup,
      scheduledDate: dto.scheduledDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      maxVolunteers: dto.maxVolunteers ?? 10,
      createdBy: { id: adminUserId } as any,
    });
    return this.campaignRepository.save(campaign);
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findById(id);

    if (dto.placeId) {
      const place = await this.placesService.findById(dto.placeId);
      campaign.place = place;
      campaign.volunteerGroup = place.volunteerGroup;
    }

    if (dto.title !== undefined) campaign.title = dto.title;
    if (dto.description !== undefined)
      campaign.description = dto.description ?? null;
    if (dto.scheduledDate !== undefined)
      campaign.scheduledDate = dto.scheduledDate;
    if (dto.startTime !== undefined) campaign.startTime = dto.startTime;
    if (dto.endTime !== undefined) campaign.endTime = dto.endTime;
    if (dto.maxVolunteers !== undefined)
      campaign.maxVolunteers = dto.maxVolunteers;

    if (campaign.endTime <= campaign.startTime) {
      throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
    }

    return this.campaignRepository.save(campaign);
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.findById(id);

    if (this.sessionsService) {
      const hasActive =
        await this.sessionsService.hasActiveSessionsForCampaign(id);
      if (hasActive) {
        throw new BadRequestException(
          'لا يمكن حذف الحملة لوجود جلسات نشطة',
        );
      }
    }

    await this.campaignRepository.remove(campaign);
  }

  async updateStatus(
    campaignId: string,
    status: CampaignStatus,
  ): Promise<void> {
    await this.campaignRepository.update(campaignId, { status });
  }

  async countOpenByPlaceId(placeId: string): Promise<number> {
    return this.campaignRepository.count({
      where: { place: { id: placeId }, status: CampaignStatus.OPEN },
    });
  }
}
