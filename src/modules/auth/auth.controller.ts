import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { AuthGuard, RefreshTokenGuard } from '../../common/guards/auth.guard.js';
import { OTPGuard } from '../../common/guards/otp.guard.js';
import {
  CurrentUser,
  OTP,
  logoutJti,
  refreshToken,
} from '../../common/decorators/index.js';
import { NormalizePhonePipe } from '../../common/pipes/normalize-phone.pipe.js';
import { LoginDto, SendOtpDto } from './auth.dto.js';
import { VerifyOtpDto } from '../otp/otp.dto.js';
import type { OtpPayload } from '../../common/types/auth.types.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  sendOtp(
    @Body(NormalizePhonePipe) body: SendOtpDto,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.authService.sendOtp(body, authHeader);
  }

  @Post('login')
  login(@Body(NormalizePhonePipe) body: LoginDto) {
    return this.authService.login(body.phone);
  }

  @Post('verify-otp')
  @UseGuards(OTPGuard)
  verifyOtp(@Body() body: VerifyOtpDto, @OTP() otp: OtpPayload) {
    return this.authService.verifyOtp(body.code, otp);
  }

  @Post('resend-otp')
  @UseGuards(OTPGuard)
  resendOtp(@OTP() otpPayload: OtpPayload) {
    return this.authService.resendOTP(otpPayload);
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
