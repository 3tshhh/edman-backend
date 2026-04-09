import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity.js';
import { GpsAuditLog } from './entities/gps-audit-log.entity.js';
import { SessionPhoto } from './entities/session-photo.entity.js';
import { CampaignEnrollment } from '../campaigns/entities/campaign-enrollment.entity.js';
import { Volunteer } from '../volunteers/volunteer.entity.js';
import { SessionsService } from './sessions.service.js';
import { SessionsController } from './sessions.controller.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      GpsAuditLog,
      SessionPhoto,
      CampaignEnrollment,
      Volunteer,
    ]),
    VolunteersModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
