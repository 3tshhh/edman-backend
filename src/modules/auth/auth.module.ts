import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpModule } from '../otp/otp.module.js';
import { UserModule } from '../user/user.module.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';
import { LoginOtpStrategy } from './strategies/login-otp.strategy.js';
import { OtpStrategyResolver } from './strategies/otp-strategy.resolver.js';

@Module({
  imports: [OtpModule, UserModule, VolunteersModule],
  controllers: [AuthController],
  providers: [AuthService, OtpStrategyResolver, LoginOtpStrategy],
})
export class AuthModule {}
