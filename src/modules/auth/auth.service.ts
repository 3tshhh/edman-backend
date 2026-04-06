import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OtpService } from '../otp/otp.service.js';
import { TokenService } from '../../common/services/token.service.js';
import { UserService } from '../user/user.service.js';
import { OtpStrategyResolver } from './strategies/otp-strategy.resolver.js';
import type { OtpPayload } from '../../common/types/auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly strategyResolver: OtpStrategyResolver,
    private readonly userService: UserService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  async login(phone: string) {
    let user = await this.userService.findByPhone(phone);
    if (!user) {
      user = await this.userService.createUser(phone);
    }

    const otpSessionToken = this.otpService.generateOtpSession({
      phone,
      purpose: 'login',
    });

    return { otpSessionToken };
  }

  async verifyOtp(code: string, otpPayload: OtpPayload) {
    const { hashedCode, purpose, jti, exp } = otpPayload;

    const isValid = this.otpService.verifyOTP(code, hashedCode);
    if (!isValid) throw new UnauthorizedException('Invalid or expired OTP');

    this.otpService.invalidate(jti, exp);

    const strategy = this.strategyResolver.resolve(purpose);
    return strategy.postVerification(otpPayload);
  }

  async logout({ jti, exp }: { jti: string; exp: number }) {
    return await this.tokenService.revokeToken(jti, exp);
  }

  async refreshToken(token: {
    jti: string;
    userId: string;
    role: string;
    exp: number;
  }) {
    const { jti, userId, role, exp } = token;
    await this.tokenService.revokeToken(jti, exp);

    return this.tokenService.generateAccessRefreshToken({
      userId,
      role,
    });
  }

  resendOTP(otpPayload: OtpPayload) {
    const { phone, purpose, jti, exp } = otpPayload;
    this.otpService.invalidate(jti, exp);
    const otpSessionToken = this.otpService.generateOtpSession({
      phone,
      purpose,
    });
    return { otpSessionToken };
  }
}
