import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity.js';
import { SubAdmin } from './entities/sub-admin.entity.js';
import { AdminsService } from './admins.service.js';
import { AdminsController } from './admins.controller.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Admin, SubAdmin]), UserModule],
  controllers: [AdminsController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
