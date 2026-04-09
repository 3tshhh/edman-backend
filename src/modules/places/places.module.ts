import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Place } from './place.entity.js';
import { Campaign } from '../campaigns/entities/campaign.entity.js';
import { PlacesService } from './places.service.js';
import { PlacesController } from './places.controller.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Place, Campaign]), VolunteersModule],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
