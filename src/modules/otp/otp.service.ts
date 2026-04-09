import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  compareHash,
  generateHash,
} from '../../common/utils/encryption/hash.utils.js';
import { getRemainingTTL } from '../../common/utils/common.utils.js';
import type { OtpPayload } from '../../common/types/auth.types.js';
import { TokenService } from '../../common/services/token.service.js';

@Injectable()
export class OtpService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly tokenService: TokenService,
  ) {}

  generate(): { code: string; hashedCode: string } {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    console.log('OTP Code:', code);

    const hashedCode = generateHash(code);
    return { code, hashedCode };
  }

  verifyOTP(code: string, hashedCode: string): boolean {
    return compareHash(code, hashedCode);
  }

  async invalidate(key: string, ttl: number): Promise<void> {
    const remainingTTL = getRemainingTTL(ttl);
    await this.cacheManager.set(`used_otp:${key}`, 1, remainingTTL);
  }

  async isUsed(key: string): Promise<boolean> {
    const isBlacklisted = await this.cacheManager.get(`used_otp:${key}`);
    return !!isBlacklisted;
  }

  generateOtpSession(
    payload: Omit<OtpPayload, 'hashedCode' | 'jti' | 'exp'>,
  ): { otpSessionToken: string; code: string } {
    const { code, hashedCode } = this.generate();

    const otpSessionToken = this.tokenService.generateToken(
      { ...payload, hashedCode },
      {
        expiresIn: '5m',
        secret: process.env.JWT_SECRET as string,
      },
    );

    return { otpSessionToken, code };
  }
}
