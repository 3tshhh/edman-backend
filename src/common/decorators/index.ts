import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard.js';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { AnyAuthGuard } from '../guards/any-auth.guard.js';
import { RolesGuard } from '../guards/roles.guard.js';
import { GroupsGuard } from '../guards/groups.guard.js';
import { UserRole } from '../constants/enums.js';
import type { IAuthUser } from '../types/auth.types.js';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return (req.loggedInUser as IAuthUser).user;
  },
);

export const OTP = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.otpPayload;
  },
);

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

export const Groups = (...groups: string[]) => SetMetadata('groups', groups);

export function Auth(...roles: string[]) {
  return applyDecorators(UseGuards(AuthGuard, RolesGuard), Roles(...roles));
}

export function AuthGroup() {
  return applyDecorators(
    UseGuards(AuthGuard, RolesGuard, GroupsGuard),
    Roles(UserRole.VOLUNTEER),
  );
}

export const logoutJti = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const { jti, exp } = ctx.switchToHttp().getRequest()
      .loggedInUser.verifiedToken;
    return { jti, exp };
  },
);

export const refreshToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const { jti, userId, role, exp } = ctx.switchToHttp().getRequest()
      .loggedInUser.verifiedToken;
    return { jti, userId, role, exp };
  },
);

export const CurrentVolunteer = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.volunteer;
  },
);

export function AdminAuth() {
  return applyDecorators(UseGuards(AdminAuthGuard));
}

export function AnyAuth() {
  return applyDecorators(UseGuards(AnyAuthGuard));
}

export const CurrentAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.loggedInAdmin.admin;
  },
);
