import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RulesService } from './rules.service.js';
import { CreateRulesDto } from './dto/create-rules.dto.js';
import {
  AdminAuth,
  AnyAuth,
  Auth,
  CurrentAdmin,
  CurrentUser,
} from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import { UserRole } from '../../common/constants/enums.js';

@ApiTags('rules')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @AnyAuth()
  getLatest() {
    return this.rulesService.getLatest();
  }

  @Post('confirm')
  @Auth(UserRole.VOLUNTEER)
  confirmRules(@CurrentUser() user: User) {
    return this.rulesService.confirmRules(user.id);
  }

  @Post()
  @AdminAuth()
  createOrUpdate(@CurrentAdmin() admin: Admin, @Body() dto: CreateRulesDto) {
    return this.rulesService.createOrUpdate(admin.id, dto.content);
  }
}
