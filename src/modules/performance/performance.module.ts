import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity.js';
import { GpsAuditLog } from '../sessions/entities/gps-audit-log.entity.js';
import { Volunteer } from '../volunteers/volunteer.entity.js';
import { PerformanceService } from './performance.service.js';
import { PerformanceController } from './performance.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Session, GpsAuditLog, Volunteer])],
  controllers: [PerformanceController],
  providers: [PerformanceService],
})
export class PerformanceModule {}
