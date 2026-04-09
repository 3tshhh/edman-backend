import { Module } from '@nestjs/common';
import { MapService } from './map.service.js';
import { MapController } from './map.controller.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { CampaignsModule } from '../campaigns/campaigns.module.js';
import { PlacesModule } from '../places/places.module.js';

@Module({
  imports: [SessionsModule, CampaignsModule, PlacesModule],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}
