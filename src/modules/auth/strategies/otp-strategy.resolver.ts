import { Injectable, BadRequestException } from '@nestjs/common';
import {
  OtpPurposeType,
  OtpVerificationStrategy,
} from './otp-verification.strategy.js';
import { LoginOtpStrategy } from './login-otp.strategy.js';

@Injectable()
export class OtpStrategyResolver {
  private readonly strategies: Record<OtpPurposeType, OtpVerificationStrategy>;

  constructor(private readonly loginStrategy: LoginOtpStrategy) {
    this.strategies = {
      login: this.loginStrategy,
    };
  }

  resolve(purpose: OtpPurposeType): OtpVerificationStrategy {
    const strategy = this.strategies[purpose];

    if (!strategy) {
      throw new BadRequestException(`Unknown OTP purpose: ${purpose}`);
    }

    return strategy;
  }
}
