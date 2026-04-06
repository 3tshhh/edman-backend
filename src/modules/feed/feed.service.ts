import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Announcement } from './announcement.entity.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { VolunteerGroup } from '../../common/constants/enums.js';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
  ) {}

  async findForVolunteer(
    volunteerGroup: VolunteerGroup,
    page: number,
    limit: number,
  ): Promise<{ data: Announcement[]; total: number }> {
    const [data, total] = await this.announcementRepository.findAndCount({
      where: [{ targetGroup: volunteerGroup }, { targetGroup: IsNull() }],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findAll(group?: VolunteerGroup): Promise<Announcement[]> {
    const where = group ? { targetGroup: group } : {};
    return this.announcementRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    dto: CreateAnnouncementDto,
    authorId: string,
    forcedGroup?: VolunteerGroup,
  ): Promise<Announcement> {
    const announcement = this.announcementRepository.create({
      title: dto.title,
      body: dto.body,
      targetGroup: forcedGroup ?? dto.targetGroup ?? null,
      attachments: dto.attachments ?? null,
      priority: dto.priority ?? null,
      author: { id: authorId } as any,
    });
    return this.announcementRepository.save(announcement);
  }

  async remove(id: string): Promise<void> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });
    if (!announcement) {
      throw new NotFoundException('الإعلان غير موجود');
    }
    await this.announcementRepository.remove(announcement);
  }
}
