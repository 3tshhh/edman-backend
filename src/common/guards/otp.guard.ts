import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../services/token.service.js';
import { OtpService } from '../../modules/otp/otp.service.js';

@Injectable()
export class OTPGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const otpSessionToken = request.headers['otp-session-token'];
    if (!otpSessionToken) throw new UnauthorizedException('please login');
    const [bearer, token] = otpSessionToken.split(' ');

    if (bearer !== process.env.JWT_PREFIX && bearer !== 'Bearer')
      throw new UnauthorizedException('invalid token');

    if (!token) {
      throw new UnauthorizedException('OTP session token is required');
    }

    const decoded = this.tokenService.verifyToken(token, {
      secret: process.env.JWT_SECRET as string,
    });

    if (!decoded) {
      throw new UnauthorizedException('Invalid or expired OTP session');
    }

    const isBlacklisted = await this.otpService.isUsed(decoded.jti);
    if (isBlacklisted)
      throw new UnauthorizedException('OTP token already used');

    request.otpPayload = decoded;
    return true;
  }
}
