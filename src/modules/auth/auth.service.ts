import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OtpService } from '../otp/otp.service.js';
import { TokenService } from '../../common/services/token.service.js';
import { UserService } from '../user/user.service.js';
import { OtpStrategyResolver } from './strategies/otp-strategy.resolver.js';
import type { OtpPayload } from '../../common/types/auth.types.js';
import { OtpPurpose, type SendOtpDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly strategyResolver: OtpStrategyResolver,
    private readonly userService: UserService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  async sendOtp(dto: SendOtpDto, authHeader?: string) {
    const purpose = dto.purpose ?? OtpPurpose.LOGIN;
    let oldPhone: string | undefined;

    if (purpose === OtpPurpose.LOGIN) {
      let user = await this.userService.findByPhone(dto.phone);
      if (!user) {
        user = await this.userService.createUser(dto.phone);
      }
    }

    if (purpose === OtpPurpose.CHANGE_PHONE) {
      if (!authHeader) {
        throw new UnauthorizedException('يجب تسجيل الدخول لتغيير رقم الهاتف');
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : authHeader;

      const decoded = this.tokenService.verifyToken(token, {
        secret: process.env.JWT_SECRET as string,
      });
      if (!decoded) {
        throw new UnauthorizedException('توكن غير صالح');
      }

      const isBlacklisted = await this.tokenService.checkBlackListed(decoded.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('توكن غير صالح');
      }

      const user = await this.userService.findById(decoded.userId);
      if (!user) {
        throw new UnauthorizedException('المستخدم غير موجود');
      }
      oldPhone = user.phone;

      const existing = await this.userService.findByPhone(dto.phone);
      if (existing) {
        throw new ConflictException('رقم الهاتف مستخدم بالفعل');
      }
    }

    const { otpSessionToken, code } = this.otpService.generateOtpSession({
      phone: dto.phone,
      purpose,
      ...(oldPhone && { oldPhone }),
    });

    console.log(`[DEV] OTP for ${dto.phone}: ${code}`);

    return { otpSessionToken };
  }

  async login(phone: string) {
    let user = await this.userService.findByPhone(phone);
    if (!user) {
      user = await this.userService.createUser(phone);
    }

    const { otpSessionToken } = this.otpService.generateOtpSession({
      phone,
      purpose: 'login',
    });

    return { otpSessionToken };
  }

  async verifyOtp(code: string, otpPayload: OtpPayload) {
    const { hashedCode, purpose, jti, exp } = otpPayload;

    const isValid = this.otpService.verifyOTP(code, hashedCode);
    if (!isValid) throw new UnauthorizedException('رمز التحقق غير صحيح أو منتهي الصلاحية');

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

  async resendOTP(otpPayload: OtpPayload) {
    const { phone, purpose, jti, exp } = otpPayload;
    this.otpService.invalidate(jti, exp);
    const { otpSessionToken } = this.otpService.generateOtpSession({
      phone,
      purpose,
    });
    return { otpSessionToken };
  }
}
