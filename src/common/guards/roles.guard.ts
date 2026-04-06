import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { log } from 'console';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const allowedRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (allowedRoles?.length === 0) return true;
    console.log('allowedRoles', allowedRoles);

    const { user } = context.switchToHttp().getRequest().loggedInUser;
    const userRole = user.role;

    if (!userRole) {
      throw new UnauthorizedException(
        "you don't have permission to access this resource 1",
      );
    }

    const hasRole = allowedRoles.includes(userRole);
    if (hasRole) return true;

    throw new UnauthorizedException(
      "you don't have permission to access this resource",
    );
  }
}
