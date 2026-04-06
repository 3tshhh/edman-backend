import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RulesService } from './rules.service.js';
import { CreateRulesDto } from './dto/create-rules.dto.js';
import { Auth, CurrentUser } from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { UserRole } from '../../common/constants/enums.js';

@ApiTags('rules')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  getLatest() {
    return this.rulesService.getLatest();
  }

  @Post('confirm')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  confirmRules(@CurrentUser() user: User) {
    return this.rulesService.confirmRules(user.id);
  }

  @Post()
  @Auth(UserRole.ADMIN)
  createOrUpdate(@CurrentUser() user: User, @Body() dto: CreateRulesDto) {
    return this.rulesService.createOrUpdate(user.id, dto.content);
  }
}
