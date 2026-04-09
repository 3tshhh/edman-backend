import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { SessionsService } from '../sessions/sessions.service.js';
import { CampaignsService } from '../campaigns/campaigns.service.js';
import { PlacesService } from '../places/places.service.js';
import {
  CampaignStatus,
  SessionStatus,
  VolunteerGroup,
} from '../../common/constants/enums.js';

@Injectable()
export class MapService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly sessionsService: SessionsService,
    private readonly campaignsService: CampaignsService,
    private readonly placesService: PlacesService,
  ) {}

  async getContext(): Promise<{
    activeVolunteers: object[];
    activeCampaigns: object[];
    places: object[];
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
        campaignTitle: session.campaign?.title ?? null,
        placeName: session.campaign?.place?.name ?? null,
      });
    }

    // Fetch active campaigns (open, full, in_progress)
    const { data: campaigns } = await this.campaignsService.findAll({
      status: `${CampaignStatus.OPEN},${CampaignStatus.FULL},${CampaignStatus.IN_PROGRESS}`,
      page: 1,
      limit: 100,
    });

    const activeCampaigns = campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      volunteerGroup: c.volunteerGroup,
      scheduledDate: c.scheduledDate,
      startTime: c.startTime,
      endTime: c.endTime,
      maxVolunteers: c.maxVolunteers,
      place: c.place
        ? {
            id: c.place.id,
            name: c.place.name,
            latitude: Number(c.place.latitude),
            longitude: Number(c.place.longitude),
          }
        : null,
    }));

    // Fetch all places
    const allPlaces = await this.placesService.findAll();
    const places = allPlaces.map((p) => ({
      id: p.id,
      name: p.name,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      volunteerGroup: p.volunteerGroup,
      address: p.address,
    }));

    return {
      activeVolunteers,
      activeCampaigns,
      places,
      summary: {
        total: activeSessions.length,
        byGroup,
        byStatus: { active: activeCount, waitingArrival: waitingCount },
      },
    };
  }
}
