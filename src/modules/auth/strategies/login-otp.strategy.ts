import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  OtpVerificationResult,
  OtpVerificationStrategy,
} from './otp-verification.strategy.js';
import { TokenService } from '../../../common/services/token.service.js';
import { UserService } from '../../user/user.service.js';
import { VolunteersService } from '../../volunteers/volunteers.service.js';
import type { OtpPayload } from '../../../common/types/auth.types.js';
import {
  ApplicationStatus,
  UserRole,
} from '../../../common/constants/enums.js';

@Injectable()
export class LoginOtpStrategy extends OtpVerificationStrategy {
  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly volunteersService: VolunteersService,
  ) {
    super();
  }

  async postVerification(payload: OtpPayload): Promise<OtpVerificationResult> {
    const user = await this.userService.findByPhone(payload.phone);
    if (!user) throw new UnauthorizedException('User not found');

    await this.userService.markPhoneVerified(user.id);

    const isNewUser = user.role === null;

    const volunteer = await this.volunteersService.findByUserId(user.id);

    // ADMIN/SUB_ADMIN users get applicationStatus 'approved' so the
    // volunteer Flutter app lets them through for testing purposes.
    const applicationStatus =
      volunteer?.applicationStatus ??
      (user.role === UserRole.ADMIN || user.role === UserRole.SUB_ADMIN
        ? ApplicationStatus.APPROVED
        : null);

    return {
      ...this.tokenService.generateAccessRefreshToken({
        userId: user.id,
        role: user.role,
      }),
      role: user.role,
      isNewUser,
      applicationStatus,
      message: 'Login verified successfully',
    };
  }
}
