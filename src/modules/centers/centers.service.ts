import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Center } from './center.entity.js';
import { CreateCenterDto } from './dto/create-center.dto.js';
import { UpdateCenterDto } from './dto/update-center.dto.js';
import { VolunteerGroup } from '../../common/constants/enums.js';
import { extractCoordsFromGoogleMapsLink } from '../../common/utils/google-maps.util.js';

@Injectable()
export class CentersService {
  constructor(
    @InjectRepository(Center)
    private readonly centerRepository: Repository<Center>,
  ) {}

  async findByGroup(volunteerGroup: VolunteerGroup): Promise<Center[]> {
    return this.centerRepository.find({ where: { volunteerGroup } });
  }

  async findAll(group?: VolunteerGroup): Promise<Center[]> {
    const where = group ? { volunteerGroup: group } : {};
    return this.centerRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Center> {
    const center = await this.centerRepository.findOne({ where: { id } });
    if (!center) {
      throw new NotFoundException('المركز غير موجود');
    }
    return center;
  }

  async create(dto: CreateCenterDto): Promise<Center> {
    const existing = await this.centerRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('يوجد مركز بنفس الاسم');
    }

    const { latitude, longitude } = extractCoordsFromGoogleMapsLink(
      dto.addressLink,
    );

    const center = this.centerRepository.create({
      ...dto,
      latitude,
      longitude,
    });
    return this.centerRepository.save(center);
  }

  async update(id: string, dto: UpdateCenterDto): Promise<Center> {
    const center = await this.findById(id);

    if (dto.name && dto.name !== center.name) {
      const existing = await this.centerRepository.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException('يوجد مركز بنفس الاسم');
      }
    }

    if (dto.addressLink) {
      const { latitude, longitude } = extractCoordsFromGoogleMapsLink(
        dto.addressLink,
      );
      center.latitude = latitude;
      center.longitude = longitude;
      center.addressLink = dto.addressLink;
    }

    if (dto.name !== undefined) center.name = dto.name;
    if (dto.description !== undefined) center.description = dto.description ?? null;
    if (dto.volunteerGroup !== undefined) center.volunteerGroup = dto.volunteerGroup;
    if (dto.address !== undefined) center.address = dto.address ?? null;

    return this.centerRepository.save(center);
  }

  async remove(id: string): Promise<void> {
    const center = await this.findById(id);
    await this.centerRepository.remove(center);
  }
}
