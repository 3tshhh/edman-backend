import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { SessionsService } from '../sessions/sessions.service.js';
import { SessionStatus, VolunteerGroup } from '../../common/constants/enums.js';

@Injectable()
export class MapService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly sessionsService: SessionsService,
  ) {}

  async getContext(): Promise<{
    activeVolunteers: object[];
    summary: {
      total: number;
      byGroup: Record<string, number>;
      byStatus: { active: number; waitingArrival: number };
    };
  }> {
    // Load all active/waiting sessions from DB
    const { data: sessions } = await this.sessionsService.findAll({
      status: undefined,
      page: 1,
      limit: 1000,
    });

    const activeSessions = sessions.filter(
      (s) =>
        s.status === SessionStatus.ACTIVE ||
        s.status === SessionStatus.WAITING_ARRIVAL,
    );

    const activeVolunteers: object[] = [];
    const byGroup: Record<string, number> = {};
    let activeCount = 0;
    let waitingCount = 0;

    for (const session of activeSessions) {
      const volunteer = session.volunteer;
      const volunteerId = volunteer.id;

      // Try to get latest location from Redis cache
      let lat = session.lastLatitude;
      let lng = session.lastLongitude;
      let timestamp: string | null = null;

      const cached = await this.cacheManager.get<string>(
        `location:${volunteerId}`,
      );
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          lat = parsed.lat;
          lng = parsed.lng;
          timestamp = parsed.timestamp;
        } catch {
          // ignore parse errors
        }
      }

      const group = volunteer.volunteerGroup;
      if (group) {
        byGroup[group] = (byGroup[group] ?? 0) + 1;
      }

      if (session.status === SessionStatus.ACTIVE) {
        activeCount++;
      } else {
        waitingCount++;
      }

      activeVolunteers.push({
        volunteerId,
        fullName: volunteer.fullName,
        volunteerGroup: group,
        lat,
        lng,
        timestamp,
        sessionStatus: session.status,
        taskTitle: session.task?.title ?? null,
        placeName: session.task?.place?.name ?? null,
      });
    }

    return {
      activeVolunteers,
      summary: {
        total: activeSessions.length,
        byGroup,
        byStatus: { active: activeCount, waitingArrival: waitingCount },
      },
    };
  }
}
