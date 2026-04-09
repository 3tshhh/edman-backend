import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VolunteersService } from './volunteers.service.js';
import { ApplyVolunteerDto } from './dto/apply-volunteer.dto.js';
import { ApproveVolunteerDto } from './dto/approve-volunteer.dto.js';
import { RejectVolunteerDto } from './dto/reject-volunteer.dto.js';
import { ChangeGroupDto } from './dto/change-group.dto.js';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto.js';
import { QueryVolunteersDto } from './dto/query-volunteers.dto.js';
import {
  Auth,
  AdminAuth,
  CurrentAdmin,
  CurrentUser,
} from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { UserRole } from '../../common/constants/enums.js';

@ApiTags('volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @Post('apply')
  @Auth()
  apply(@CurrentUser() user: User, @Body() dto: ApplyVolunteerDto) {
    return this.volunteersService.apply(user.id, dto);
  }

  @Get('me')
  @Auth(UserRole.VOLUNTEER)
  getMyProfile(@CurrentUser() user: User) {
    return this.volunteersService.getMyProfile(user.id);
  }

  @Get('me/history')
  @Auth(UserRole.VOLUNTEER)
  getMyHistory(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.volunteersService.getMyHistory(user.id, page ?? 1, limit ?? 20);
  }

  @Patch('me/fcm-token')
  @Auth(UserRole.VOLUNTEER)
  updateFcmToken(@CurrentUser() user: User, @Body() dto: UpdateFcmTokenDto) {
    return this.volunteersService.updateFcmToken(user.id, dto.fcmToken);
  }

  @Get()
  @AdminAuth()
  findAll(@Query() query: QueryVolunteersDto) {
    return this.volunteersService.findAll(query);
  }

  @Get('applications')
  @AdminAuth()
  findApplications(@Query() query: QueryVolunteersDto) {
    return this.volunteersService.findApplications(query);
  }

  @Get(':id')
  @AdminAuth()
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.volunteersService.findById(id);
  }

  @Patch(':id/approve')
  @AdminAuth()
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveVolunteerDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.volunteersService.approve(id, dto, admin.id);
  }

  @Patch(':id/reject')
  @AdminAuth()
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVolunteerDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.volunteersService.reject(id, dto, admin.id);
  }

  @Patch(':id/group')
  @AdminAuth()
  changeGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeGroupDto,
  ) {
    return this.volunteersService.changeGroup(id, dto);
  }

  @Patch(':id/ban')
  @AdminAuth()
  ban(@Param('id', ParseUUIDPipe) id: string) {
    return this.volunteersService.ban(id);
  }
}
