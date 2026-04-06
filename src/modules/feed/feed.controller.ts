import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FeedService } from './feed.service.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { QueryFeedDto } from './dto/query-feed.dto.js';
import { Auth, CurrentUser } from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { UserRole, VolunteerGroup } from '../../common/constants/enums.js';
import { AdminsService } from '../admins/admins.service.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(
    private readonly feedService: FeedService,
    private readonly adminsService: AdminsService,
    private readonly volunteersService: VolunteersService,
  ) {}

  @Get()
  @Auth()
  async findAll(@CurrentUser() user: User, @Query() query: QueryFeedDto) {
    // Volunteer: scoped to their group
    if (user.role === UserRole.VOLUNTEER) {
      const volunteer = await this.volunteersService.findByUserId(user.id);
      if (!volunteer?.volunteerGroup) {
        return { data: [], total: 0 };
      }
      return this.feedService.findForVolunteer(
        volunteer.volunteerGroup,
        query.page ?? 1,
        query.limit ?? 20,
      );
    }

    // SUB_ADMIN: scoped to assigned group
    if (user.role === UserRole.SUB_ADMIN) {
      const subAdmin = await this.adminsService.findSubAdminByUserId(user.id);
      if (subAdmin) {
        return this.feedService.findAll(subAdmin.assignedGroup);
      }
    }

    // ADMIN: optionally filtered
    return this.feedService.findAll(query.group);
  }

  @Post()
  @Auth(UserRole.ADMIN, UserRole.SUB_ADMIN)
  async create(@CurrentUser() user: User, @Body() dto: CreateAnnouncementDto) {
    // SUB_ADMIN: force targetGroup = assignedGroup
    let forcedGroup: VolunteerGroup | undefined;
    if (user.role === UserRole.SUB_ADMIN) {
      const subAdmin = await this.adminsService.findSubAdminByUserId(user.id);
      if (subAdmin) {
        forcedGroup = subAdmin.assignedGroup;
      }
    }

    return this.feedService.create(dto, user.id, forcedGroup);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedService.remove(id);
  }
}
