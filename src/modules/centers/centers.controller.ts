import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CentersService } from './centers.service.js';
import { CreateCenterDto } from './dto/create-center.dto.js';
import { UpdateCenterDto } from './dto/update-center.dto.js';
import {
  Auth,
  AuthGroup,
  CurrentVolunteer,
} from '../../common/decorators/index.js';
import { UserRole } from '../../common/constants/enums.js';
import type { Volunteer } from '../volunteers/volunteer.entity.js';

@ApiTags('centers')
@Controller('centers')
export class CentersController {
  constructor(private readonly centersService: CentersService) {}

  @Get()
  @AuthGroup()
  findByGroup(@CurrentVolunteer() volunteer: Volunteer) {
    return this.centersService.findByGroup(volunteer.volunteerGroup!);
  }

  @Get(':id')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.centersService.findById(id);
  }

  @Post()
  @Auth(UserRole.ADMIN)
  create(@Body() dto: CreateCenterDto) {
    return this.centersService.create(dto);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCenterDto) {
    return this.centersService.update(id, dto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.centersService.remove(id);
  }
}
