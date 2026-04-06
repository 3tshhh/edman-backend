import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rules } from './rules.entity.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(Rules)
    private readonly rulesRepository: Repository<Rules>,
    private readonly volunteersService: VolunteersService,
  ) {}

  async getLatest(): Promise<Rules | null> {
    return this.rulesRepository.findOne({
      order: { version: 'DESC' },
    });
  }

  async createOrUpdate(adminUserId: string, content: string): Promise<Rules> {
    const existing = await this.getLatest();

    if (existing) {
      existing.content = content;
      existing.version = existing.version + 1;
      existing.updatedBy = { id: adminUserId } as any;
      return this.rulesRepository.save(existing);
    }

    const rules = this.rulesRepository.create({
      content,
      version: 1,
      updatedBy: { id: adminUserId } as any,
    });
    return this.rulesRepository.save(rules);
  }

  async confirmRules(
    userId: string,
  ): Promise<{ rulesConfirmedVersion: number }> {
    const rules = await this.getLatest();
    if (!rules) {
      throw new NotFoundException('لا توجد قوانين حالياً');
    }

    const volunteer = await this.volunteersService.findByUserId(userId);
    if (!volunteer) {
      throw new NotFoundException('لم يتم العثور على ملف المتطوع');
    }

    await this.volunteersService.confirmRules(volunteer.id, rules.version);
    return { rulesConfirmedVersion: rules.version };
  }
}
