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
import { PlacesService } from './places.service.js';
import { CreatePlaceDto } from './dto/create-place.dto.js';
import { UpdatePlaceDto } from './dto/update-place.dto.js';
import {
  AdminAuth,
  AnyAuth,
  AuthGroup,
  CurrentVolunteer,
} from '../../common/decorators/index.js';
import { VolunteerGroup } from '../../common/constants/enums.js';
import type { Volunteer } from '../volunteers/volunteer.entity.js';

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('mine')
  @AuthGroup()
  findMine(@CurrentVolunteer() volunteer: Volunteer) {
    return this.placesService.findByGroup(volunteer.volunteerGroup!);
  }

  @Get()
  @AdminAuth()
  findAll(@Query('group') group?: VolunteerGroup) {
    return this.placesService.findAll(group);
  }

  @Get(':id')
  @AnyAuth()
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.placesService.findById(id);
  }

  @Post()
  @AdminAuth()
  create(@Body() dto: CreatePlaceDto) {
    return this.placesService.create(dto);
  }

  @Patch(':id')
  @AdminAuth()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlaceDto) {
    return this.placesService.update(id, dto);
  }

  @Delete(':id')
  @AdminAuth()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.placesService.remove(id);
  }
}
