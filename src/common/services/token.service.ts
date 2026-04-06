import { Inject, Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { getRemainingTTL } from '../utils/common.utils.js';

@Injectable()
export class TokenService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly jwtService: JwtService,
  ) {}

  generateToken = (
    payload: Record<string, unknown>,
    options: JwtSignOptions,
  ) => {
    if (!payload.jti) {
      payload.jti = randomUUID();
    }
    return this.jwtService.sign(payload, options);
  };

  verifyToken = (token: string, options: JwtVerifyOptions) => {
    try {
      const verifiedToken = this.jwtService.verify(token, options);
      return verifiedToken;
    } catch {
      return null;
    }
  };

  generateAccessRefreshToken = (payload: object) => {
    const jti = randomUUID();

    const accessToken = this.generateToken(
      { ...payload, jti },
      {
        expiresIn: (process.env.JWT_EXPIRES_IN ||
          '15m') as unknown as import('ms').StringValue,
        secret: process.env.JWT_SECRET,
      },
    );
    const refreshToken = this.generateToken(
      { ...payload, jti },
      {
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ||
          '7d') as unknown as import('ms').StringValue,
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );

    return { accessToken, refreshToken };
  };

  revokeToken = async (jti: string, exp: number): Promise<number> => {
    const remainingTTL = getRemainingTTL(exp);
    const bl = this.cacheManager.set(`blacklisted:${jti}`, 1, remainingTTL);
    return bl;
  };

  checkBlackListed = async (jti: string): Promise<boolean> => {
    const isBlacklisted = await this.cacheManager.get(`blacklisted:${jti}`);
    return !!isBlacklisted;
  };
}
