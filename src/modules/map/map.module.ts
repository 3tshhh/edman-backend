import { Module } from '@nestjs/common';
import { MapService } from './map.service.js';
import { MapController } from './map.controller.js';
import { SessionsModule } from '../sessions/sessions.module.js';

@Module({
  imports: [SessionsModule],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}
