import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from './place.entity.js';
import { Campaign } from '../campaigns/entities/campaign.entity.js';
import { CreatePlaceDto } from './dto/create-place.dto.js';
import { UpdatePlaceDto } from './dto/update-place.dto.js';
import { CampaignStatus, VolunteerGroup } from '../../common/constants/enums.js';
import { extractCoordsFromGoogleMapsLink } from '../../common/utils/google-maps.util.js';
import type { SessionsService } from '../sessions/sessions.service.js';

@Injectable()
export class PlacesService {
  private sessionsService: SessionsService | null = null;

  constructor(
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {}

  setSessionsService(sessionsService: SessionsService): void {
    this.sessionsService = sessionsService;
  }

  async findAll(group?: VolunteerGroup): Promise<Place[]> {
    const where = group ? { volunteerGroup: group } : {};
    return this.placeRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findByGroup(
    volunteerGroup: VolunteerGroup,
  ): Promise<(Place & { openCampaignCount: number })[]> {
    const places = await this.placeRepository.find({
      where: { volunteerGroup },
    });

    const results = await Promise.all(
      places.map(async (place) => {
        const openCampaignCount = await this.campaignRepository.count({
          where: { place: { id: place.id }, status: CampaignStatus.OPEN },
        });
        return { ...place, openCampaignCount };
      }),
    );

    return results;
  }

  async findById(id: string): Promise<Place> {
    const place = await this.placeRepository.findOne({ where: { id } });
    if (!place) {
      throw new NotFoundException('المكان غير موجود');
    }
    return place;
  }

  async create(dto: CreatePlaceDto): Promise<Place> {
    const existing = await this.placeRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('يوجد مكان بنفس الاسم');
    }

    const { latitude, longitude } = extractCoordsFromGoogleMapsLink(
      dto.addressLink,
    );

    const place = this.placeRepository.create({
      ...dto,
      latitude,
      longitude,
    });
    return this.placeRepository.save(place);
  }

  async update(id: string, dto: UpdatePlaceDto): Promise<Place> {
    const place = await this.findById(id);

    if (dto.name && dto.name !== place.name) {
      const existing = await this.placeRepository.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException('يوجد مكان بنفس الاسم');
      }
    }

    if (dto.addressLink) {
      const { latitude, longitude } = extractCoordsFromGoogleMapsLink(
        dto.addressLink,
      );
      place.latitude = latitude;
      place.longitude = longitude;
      place.addressLink = dto.addressLink;
    }

    if (dto.name !== undefined) place.name = dto.name;
    if (dto.description !== undefined) place.description = dto.description ?? null;
    if (dto.volunteerGroup !== undefined) place.volunteerGroup = dto.volunteerGroup;
    if (dto.placeType !== undefined) place.placeType = dto.placeType ?? null;
    if (dto.photoKey !== undefined) place.photoKey = dto.photoKey ?? null;
    if (dto.address !== undefined) place.address = dto.address ?? null;
    if (dto.proximityThresholdMeters !== undefined)
      place.proximityThresholdMeters = dto.proximityThresholdMeters;

    return this.placeRepository.save(place);
  }

  async remove(id: string): Promise<void> {
    const place = await this.findById(id);

    if (this.sessionsService) {
      const hasActive =
        await this.sessionsService.hasActiveSessionsForPlace(id);
      if (hasActive) {
        throw new BadRequestException('لا يمكن حذف المكان لوجود جلسات نشطة');
      }
    }

    await this.placeRepository.remove(place);
  }
}
