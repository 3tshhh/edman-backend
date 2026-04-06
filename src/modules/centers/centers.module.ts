import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Center } from './center.entity.js';
import { CentersService } from './centers.service.js';
import { CentersController } from './centers.controller.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Center]), VolunteersModule],
  controllers: [CentersController],
  providers: [CentersService],
})
export class CentersModule {}
