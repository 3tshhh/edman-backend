import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionsService } from './sessions.service.js';
import { GpsPingDto } from './dto/gps-ping.dto.js';
import { LeaveSessionDto } from './dto/leave-session.dto.js';
import { SessionPhotoDto } from './dto/session-photo.dto.js';
import { SessionFeedbackDto } from './dto/session-feedback.dto.js';
import { QuerySessionsDto } from './dto/query-sessions.dto.js';
import { Auth, CurrentUser } from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { UserRole } from '../../common/constants/enums.js';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('active')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  findActive(@CurrentUser() user: User) {
    return this.sessionsService.findActive(user.id);
  }

  @Get('history')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  findHistory(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.sessionsService.findHistory(user.id, page ?? 1, limit ?? 20);
  }

  @Post(':id/gps-ping')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  gpsPing(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: GpsPingDto,
  ) {
    return this.sessionsService.gpsPing(id, user.id, dto.lat, dto.lng);
  }

  @Post(':id/leave')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  leaveEarly(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: LeaveSessionDto,
  ) {
    return this.sessionsService.leaveEarly(id, user.id, dto.reason);
  }

  @Post(':id/photos')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: SessionPhotoDto,
  ) {
    return this.sessionsService.addPhoto(id, user.id, dto.photoKey);
  }

  @Post(':id/feedback')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  submitFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: SessionFeedbackDto,
  ) {
    return this.sessionsService.submitFeedback(id, user.id, dto.text);
  }

  @Get()
  @Auth(UserRole.ADMIN)
  findAll(@Query() query: QuerySessionsDto) {
    return this.sessionsService.findAll(query);
  }

  @Post(':id/abandon')
  @Auth(UserRole.ADMIN)
  abandon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveSessionDto,
  ) {
    return this.sessionsService.abandon(id, dto.reason);
  }
}
