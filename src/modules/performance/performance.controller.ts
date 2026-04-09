import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PerformanceService } from './performance.service.js';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto.js';
import { AdminAuth, Auth, CurrentUser } from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { UserRole } from '../../common/constants/enums.js';

@ApiTags('performance')
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('me')
  @Auth(UserRole.VOLUNTEER)
  getMyPerformance(@CurrentUser() user: User) {
    return this.performanceService.getMyPerformance(user.id);
  }

  @Get('leaderboard')
  @AdminAuth()
  getLeaderboard(@Query() query: QueryLeaderboardDto) {
    return this.performanceService.getLeaderboard(query);
  }

  @Get('groups')
  @AdminAuth()
  getGroupStats() {
    return this.performanceService.getGroupStats();
  }

  @Get('volunteers/:id')
  @AdminAuth()
  getVolunteerPerformance(@Param('id', ParseUUIDPipe) id: string) {
    return this.performanceService.getVolunteerPerformance(id);
  }
}
