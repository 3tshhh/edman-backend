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
import { CampaignsService } from './campaigns.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';
import { QueryCampaignsDto } from './dto/query-campaigns.dto.js';
import {
  AdminAuth,
  AnyAuth,
  Auth,
  AuthGroup,
  CurrentAdmin,
  CurrentUser,
  CurrentVolunteer,
} from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { UserRole } from '../../common/constants/enums.js';
import type { Volunteer } from '../volunteers/volunteer.entity.js';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('mine')
  @AuthGroup()
  findMine(@CurrentVolunteer() volunteer: Volunteer) {
    return this.campaignsService.findMine(volunteer.volunteerGroup!, volunteer.id);
  }

  @Get()
  @AdminAuth()
  findAll(@Query() query: QueryCampaignsDto) {
    return this.campaignsService.findAll(query);
  }

  @Get(':id')
  @AnyAuth()
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.findById(id);
  }

  @Post(':id/enroll')
  @Auth(UserRole.VOLUNTEER)
  enroll(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.campaignsService.enroll(id, user.id);
  }

  @Post()
  @AdminAuth()
  create(@CurrentAdmin() admin: Admin, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto, admin.id);
  }

  @Patch(':id')
  @AdminAuth()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @AdminAuth()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.remove(id);
  }
}
