import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CentersService } from './centers.service.js';
import { CreateCenterDto } from './dto/create-center.dto.js';
import { UpdateCenterDto } from './dto/update-center.dto.js';
import {
  AdminAuth,
  AnyAuth,
  AuthGroup,
  CurrentVolunteer,
} from '../../common/decorators/index.js';
import { VolunteerGroup } from '../../common/constants/enums.js';
import type { Volunteer } from '../volunteers/volunteer.entity.js';

@ApiTags('centers')
@Controller('centers')
export class CentersController {
  constructor(private readonly centersService: CentersService) {}

  @Get('mine')
  @AuthGroup()
  findMine(@CurrentVolunteer() volunteer: Volunteer) {
    return this.centersService.findByGroup(volunteer.volunteerGroup!);
  }

  @Get()
  @AdminAuth()
  findAll(@Query('group') group?: VolunteerGroup) {
    return this.centersService.findAll(group);
  }

  @Get(':id')
  @AnyAuth()
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.centersService.findById(id);
  }

  @Post()
  @AdminAuth()
  create(@Body() dto: CreateCenterDto) {
    return this.centersService.create(dto);
  }

  @Patch(':id')
  @AdminAuth()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCenterDto) {
    return this.centersService.update(id, dto);
  }

  @Delete(':id')
  @AdminAuth()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.centersService.remove(id);
  }
}
