import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from './place.entity.js';
import { Task } from '../tasks/entities/task.entity.js';
import { CreatePlaceDto } from './dto/create-place.dto.js';
import { UpdatePlaceDto } from './dto/update-place.dto.js';
import { TaskStatus, VolunteerGroup } from '../../common/constants/enums.js';
import type { SessionsService } from '../sessions/sessions.service.js';

@Injectable()
export class PlacesService {
  private sessionsService: SessionsService | null = null;

  constructor(
    @InjectRepository(Place)
    private readonly placeRepository: Repository<Place>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
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
  ): Promise<(Place & { openTaskCount: number })[]> {
    const places = await this.placeRepository.find({
      where: { volunteerGroup },
    });

    const results = await Promise.all(
      places.map(async (place) => {
        const openTaskCount = await this.taskRepository.count({
          where: { place: { id: place.id }, status: TaskStatus.OPEN },
        });
        return { ...place, openTaskCount };
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

    const place = this.placeRepository.create(dto);
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

    Object.assign(place, dto);
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
