import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { Auth, CurrentUser } from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread')
  @Auth()
  getUnread(@CurrentUser() user: User) {
    return this.notificationsService.getUnread(user.id);
  }

  @Post(':id/read')
  @Auth()
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }
}
