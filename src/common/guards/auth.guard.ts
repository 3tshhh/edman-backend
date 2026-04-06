import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../services/token.service.js';
import { UserService } from '../../modules/user/user.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const accessToken = request.headers['authorization'];
    if (!accessToken) throw new BadRequestException('please login');
    const [bearer, token] = accessToken.split(' ');
    if (!token) throw new BadRequestException('please login');

    if (bearer !== process.env.JWT_PREFIX && bearer !== 'Bearer')
      throw new BadRequestException('invalid token');

    const verifiedToken = this.tokenService.verifyToken(token, {
      secret: process.env.JWT_SECRET as string,
    });
    if (!verifiedToken) throw new BadRequestException('please login');

    const isBlacklisted = await this.tokenService.checkBlackListed(
      verifiedToken.jti,
    );

    if (isBlacklisted) throw new BadRequestException('please login');

    const user = await this.userService.findById(verifiedToken.userId);
    if (!user) throw new BadRequestException('User no longer exists');

    request.loggedInUser = {
      verifiedToken,
      user,
    };
    return true;
  }
}

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const refreshToken = request.headers['authorization-refresh'];

    if (!refreshToken) throw new UnauthorizedException('please login');

    const [bearer, token] = refreshToken.split(' ');
    if (!token || (bearer !== process.env.JWT_PREFIX && bearer !== 'Bearer'))
      throw new UnauthorizedException('Invalid token');

    const verifiedRefreshToken = this.tokenService.verifyToken(token, {
      secret: process.env.JWT_REFRESH_SECRET as string,
    });
    if (!verifiedRefreshToken)
      throw new UnauthorizedException('Invalid session, please login again');

    const [isBlacklisted, user] = await Promise.all([
      this.tokenService.checkBlackListed(verifiedRefreshToken.jti),
      this.userService.findById(verifiedRefreshToken.userId),
    ]);

    if (isBlacklisted || !user)
      throw new UnauthorizedException('Invalid session, please login again');

    request.loggedInUser = { verifiedToken: verifiedRefreshToken };
    return true;
  }
}
