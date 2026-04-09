import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { TokenService } from '../services/token.service.js';
import { AdminsService } from '../../modules/admins/admins.service.js';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly adminsService: AdminsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const accessToken = request.headers['authorization'];
    if (!accessToken) throw new BadRequestException('يرجى تسجيل الدخول');

    const [bearer, token] = accessToken.split(' ');
    if (!token) throw new BadRequestException('يرجى تسجيل الدخول');

    if (bearer !== 'Bearer')
      throw new BadRequestException('رمز غير صالح');

    const verifiedToken = this.tokenService.verifyToken(token, {
      secret: process.env.JWT_SECRET as string,
    });
    if (!verifiedToken || verifiedToken.role !== 'admin')
      throw new BadRequestException('يرجى تسجيل الدخول');

    const isBlacklisted = await this.tokenService.checkBlackListed(
      verifiedToken.jti,
    );
    if (isBlacklisted) throw new BadRequestException('يرجى تسجيل الدخول');

    const admin = await this.adminsService.findById(verifiedToken.adminId);
    if (!admin) throw new BadRequestException('المدير غير موجود');

    request.loggedInAdmin = { admin, verifiedToken };
    return true;
  }
}
