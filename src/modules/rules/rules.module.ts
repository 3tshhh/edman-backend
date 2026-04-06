import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rules } from './rules.entity.js';
import { RulesService } from './rules.service.js';
import { RulesController } from './rules.controller.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Rules]), VolunteersModule],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
