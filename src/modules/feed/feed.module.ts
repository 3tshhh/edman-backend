import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './announcement.entity.js';
import { FeedService } from './feed.service.js';
import { FeedController } from './feed.controller.js';
import { AdminsModule } from '../admins/admins.module.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement]),
    AdminsModule,
    VolunteersModule,
  ],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
