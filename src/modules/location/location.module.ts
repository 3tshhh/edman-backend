import { Module } from '@nestjs/common';
import { LocationGateway } from './location.gateway.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';
import { UserModule } from '../user/user.module.js';
import { CampaignsModule } from '../campaigns/campaigns.module.js';

@Module({
  imports: [SessionsModule, VolunteersModule, UserModule, CampaignsModule],
  providers: [LocationGateway],
})
export class LocationModule {}
