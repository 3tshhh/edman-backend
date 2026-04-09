import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../services/token.service.js';
import { UserService } from '../../modules/user/user.service.js';
import { AdminsService } from '../../modules/admins/admins.service.js';

/**
 * Guard that accepts both volunteer (user) tokens and admin tokens.
 * Sets request.loggedInUser for volunteer tokens, request.loggedInAdmin for admin tokens.
 */
@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly adminsService: AdminsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const accessToken = request.headers['authorization'];
    if (!accessToken) throw new UnauthorizedException('يرجى تسجيل الدخول');

    const [bearer, token] = accessToken.split(' ');
    if (!token || bearer !== 'Bearer')
      throw new UnauthorizedException('رمز غير صالح');

    const verifiedToken = this.tokenService.verifyToken(token, {
      secret: process.env.JWT_SECRET as string,
    });
    if (!verifiedToken) throw new UnauthorizedException('يرجى تسجيل الدخول');

    const isBlacklisted = await this.tokenService.checkBlackListed(
      verifiedToken.jti,
    );
    if (isBlacklisted) throw new UnauthorizedException('يرجى تسجيل الدخول');

    // Admin token
    if (verifiedToken.role === 'admin' && verifiedToken.adminId) {
      const admin = await this.adminsService.findById(verifiedToken.adminId);
      if (!admin) throw new UnauthorizedException('المدير غير موجود');
      request.loggedInAdmin = { admin, verifiedToken };
      request.authRole = 'admin';
      return true;
    }

    // Volunteer/User token
    if (verifiedToken.userId) {
      const user = await this.userService.findById(verifiedToken.userId);
      if (!user) throw new UnauthorizedException('المستخدم غير موجود');
      request.loggedInUser = { verifiedToken, user };
      request.authRole = 'user';
      return true;
    }

    throw new UnauthorizedException('رمز غير صالح');
  }
}
