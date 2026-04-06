import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { OTPGuard } from '../../common/guards/otp.guard.js';
import { RefreshTokenGuard } from '../../common/guards/auth.guard.js';
import {
  CurrentUser,
  OTP,
  logoutJti,
  refreshToken,
} from '../../common/decorators/index.js';
import { NormalizePhonePipe } from '../../common/pipes/normalize-phone.pipe.js';
import { LoginDto } from './auth.dto.js';
import { VerifyOtpDto } from '../otp/otp.dto.js';
import type { OtpPayload } from '../../common/types/auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body(NormalizePhonePipe) body: LoginDto) {
    return this.authService.login(body.phone);
  }

  @Post('verify-otp')
  @UseGuards(OTPGuard)
  async verifyOtp(@Body() body: VerifyOtpDto, @OTP() otp: OtpPayload) {
    return this.authService.verifyOtp(body.code, otp);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@logoutJti() token: { jti: string; exp: number }) {
    return this.authService.logout(token);
  }

  @Post('refresh-token')
  @UseGuards(RefreshTokenGuard)
  refreshTokenEndpoint(
    @refreshToken()
    token: {
      jti: string;
      userId: string;
      role: string;
      exp: number;
    },
  ) {
    return this.authService.refreshToken(token);
  }

  @Post('resend-otp')
  @UseGuards(OTPGuard)
  resendOtp(@OTP() otpPayload: OtpPayload) {
    return this.authService.resendOTP(otpPayload);
  }

  @Get('check-token')
  @UseGuards(AuthGuard)
  checkToken(@CurrentUser() user: any) {
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,
    };
  }
}
