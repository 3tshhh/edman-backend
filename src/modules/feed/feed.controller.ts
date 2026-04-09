import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FeedService } from './feed.service.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { QueryFeedDto } from './dto/query-feed.dto.js';
import {
  AdminAuth,
  AnyAuth,
  CurrentAdmin,
} from '../../common/decorators/index.js';
import { Admin } from '../admins/entities/admin.entity.js';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(
    private readonly feedService: FeedService,
    private readonly volunteersService: VolunteersService,
  ) {}

  @Get()
  @AnyAuth()
  async findFeed(@Req() req: any, @Query() query: QueryFeedDto) {
    if (req.authRole === 'admin') {
      return this.feedService.findAll(query.group);
    }

    // Volunteer
    const user = req.loggedInUser?.user;
    const volunteer = await this.volunteersService.findByUserId(user.id);
    if (!volunteer?.volunteerGroup) {
      return { data: [], total: 0 };
    }
    console.log(volunteer.volunteerGroup);
    
    return this.feedService.findForVolunteer(
      volunteer.volunteerGroup,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post()
  @AdminAuth()
  create(@CurrentAdmin() admin: Admin, @Body() dto: CreateAnnouncementDto) {
    return this.feedService.create(dto, admin.id);
  }

  @Delete()
  @AdminAuth()
  removeAll() {
    return this.feedService.removeAll();
  }

  @Delete(':id')
  @AdminAuth()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedService.remove(id);
  }
}
