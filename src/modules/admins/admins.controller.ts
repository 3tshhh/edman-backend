import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminsService } from './admins.service.js';
import { AdminLoginDto } from './dto/admin-login.dto.js';
import { AdminRegisterDto } from './dto/admin-register.dto.js';
import { AdminAuth } from '../../common/decorators/index.js';

@ApiTags('admins')
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminsService.login(dto);
  }

  @Post('register')
  @AdminAuth()
  register(@Body() dto: AdminRegisterDto) {
    return this.adminsService.register(dto);
  }
}
