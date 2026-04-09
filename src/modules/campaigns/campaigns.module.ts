import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity.js';
import { CampaignEnrollment } from './entities/campaign-enrollment.entity.js';
import { Session } from '../sessions/entities/session.entity.js';
import { CampaignsService } from './campaigns.service.js';
import { CampaignsController } from './campaigns.controller.js';
import { PlacesModule } from '../places/places.module.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';
import { RulesModule } from '../rules/rules.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignEnrollment, Session]),
    PlacesModule,
    VolunteersModule,
    RulesModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
