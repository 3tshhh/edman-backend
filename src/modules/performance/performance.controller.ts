import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PerformanceService } from './performance.service.js';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto.js';
import { Auth, CurrentUser } from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { UserRole } from '../../common/constants/enums.js';

@ApiTags('performance')
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('me')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  getMyPerformance(@CurrentUser() user: User) {
    return this.performanceService.getMyPerformance(user.id);
  }

  @Get('leaderboard')
  @Auth(UserRole.ADMIN)
  getLeaderboard(@Query() query: QueryLeaderboardDto) {
    return this.performanceService.getLeaderboard(query);
  }

  @Get('groups')
  @Auth(UserRole.ADMIN)
  getGroupStats() {
    return this.performanceService.getGroupStats();
  }

  @Get('volunteers/:id')
  @Auth(UserRole.ADMIN)
  getVolunteerPerformance(@Param('id', ParseUUIDPipe) id: string) {
    return this.performanceService.getVolunteerPerformance(id);
  }
}
