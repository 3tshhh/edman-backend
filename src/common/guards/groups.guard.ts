import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { VolunteersService } from '../../modules/volunteers/volunteers.service.js';

@Injectable()
export class GroupsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly volunteersService: VolunteersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.loggedInUser?.user;
    if (!user) {
      throw new ForbiddenException('غير مصرح لك بالوصول');
    }

    const volunteer = await this.volunteersService.findByUserId(user.id);
    if (!volunteer || !volunteer.volunteerGroup) {
      throw new ForbiddenException('غير مصرح لك بالوصول');
    }

    // Always attach volunteer to request so controllers can read it via @CurrentVolunteer()
    request.volunteer = volunteer;

    // If specific groups are required, enforce them
    const requiredGroups = this.reflector.get<string[]>(
      'groups',
      context.getHandler(),
    );
    if (requiredGroups && !requiredGroups.includes(volunteer.volunteerGroup)) {
      throw new ForbiddenException('غير مصرح لك بالوصول');
    }

    return true;
  }
}
