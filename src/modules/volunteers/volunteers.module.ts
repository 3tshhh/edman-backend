import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Volunteer } from './volunteer.entity.js';
import { VolunteersService } from './volunteers.service.js';
import { VolunteersController } from './volunteers.controller.js';
import { UserModule } from '../user/user.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Volunteer]),
    UserModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [VolunteersController],
  providers: [VolunteersService],
  exports: [VolunteersService],
})
export class VolunteersModule {}
