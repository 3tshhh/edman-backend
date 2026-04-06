import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminsService } from './admins.service.js';
import { CreateSubAdminDto } from './dto/create-sub-admin.dto.js';
import { Auth } from '../../common/decorators/index.js';
import { UserRole } from '../../common/constants/enums.js';

@ApiTags('admins')
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post('sub-admins')
  @Auth(UserRole.ADMIN)
  createSubAdmin(@Body() dto: CreateSubAdminDto) {
    return this.adminsService.createSubAdmin(dto.phone, dto.assignedGroup);
  }

  @Get('sub-admins')
  @Auth(UserRole.ADMIN)
  findAllSubAdmins() {
    return this.adminsService.findAllSubAdmins();
  }

  @Delete('sub-admins/:id')
  @Auth(UserRole.ADMIN)
  removeSubAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminsService.removeSubAdmin(id);
  }
}
