import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TokenService } from '../../common/services/token.service.js';
import { UserService } from '../user/user.service.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { UserRole } from '../../common/constants/enums.js';
import { isWithinProximity } from '../../common/utils/location.utils.js';

const LOCATION_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

interface SocketData {
  userId: string;
  role: UserRole | null;
  volunteerId?: string;
  fullName?: string;
  volunteerGroup?: string;
}

@WebSocketGateway({ cors: true, namespace: '/location' })
export class LocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(LocationGateway.name);
  private readonly socketDataMap = new Map<string, SocketData>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly volunteersService: VolunteersService,
    private readonly sessionsService: SessionsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        (client.handshake.headers?.authorization as string);

      if (!token) {
        client.disconnect();
        return;
      }

      const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const verified = this.tokenService.verifyToken(rawToken, {
        secret: process.env.JWT_SECRET as string,
      });

      if (!verified) {
        client.disconnect();
        return;
      }

      const isBlacklisted = await this.tokenService.checkBlackListed(
        verified.jti,
      );
      if (isBlacklisted) {
        client.disconnect();
        return;
      }

      const user = await this.userService.findById(verified.userId);
      if (!user) {
        client.disconnect();
        return;
      }

      const socketData: SocketData = {
        userId: user.id,
        role: user.role,
      };

      if (user.role === UserRole.ADMIN || user.role === UserRole.SUB_ADMIN) {
        await client.join('admin-live-map');
      }

      if (user.role === UserRole.VOLUNTEER) {
        const volunteer = await this.volunteersService.findByUserId(user.id);
        if (volunteer) {
          socketData.volunteerId = volunteer.id;
          socketData.fullName = volunteer.fullName;
          socketData.volunteerGroup = volunteer.volunteerGroup ?? undefined;
          await client.join(`volunteer:${volunteer.id}`);
        }
      }

      this.socketDataMap.set(client.id, socketData);
      this.logger.log(
        `Client connected: ${client.id} (${user.role ?? 'no-role'})`,
      );
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const data = this.socketDataMap.get(client.id);
    if (data?.volunteerId) {
      await this.cacheManager.del(`location:${data.volunteerId}`);
      this.server.to('admin-live-map').emit('admin:volunteer-offline', {
        volunteerId: data.volunteerId,
      });
    }
    this.socketDataMap.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('volunteer:location')
  async handleLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { lat: number; lng: number },
  ): Promise<void> {
    const data = this.socketDataMap.get(client.id);
    if (!data || data.role !== UserRole.VOLUNTEER || !data.volunteerId) {
      return;
    }

    const { lat, lng } = payload;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    // Cache location in Redis
    const cachePayload = JSON.stringify({
      lat,
      lng,
      timestamp: new Date().toISOString(),
    });
    await this.cacheManager.set(
      `location:${data.volunteerId}`,
      cachePayload,
      LOCATION_CACHE_TTL_MS,
    );

    // Broadcast to admin live map
    this.server.to('admin-live-map').emit('admin:volunteer-location', {
      volunteerId: data.volunteerId,
      fullName: data.fullName,
      lat,
      lng,
      timestamp: new Date().toISOString(),
      volunteerGroup: data.volunteerGroup,
    });

    // Check for active session
    const session = await this.sessionsService.findActiveSessionForVolunteer(
      data.volunteerId,
    );
    if (!session) return;

    if (session.status === 'waiting_arrival') {
      const place = session.task.place;
      const withinRange = isWithinProximity(
        lat,
        lng,
        Number(place.latitude),
        Number(place.longitude),
        place.proximityThresholdMeters,
      );

      if (withinRange) {
        try {
          const confirmed = await this.sessionsService.confirmArrival(
            session.id,
            data.volunteerId,
            { lat, lng },
          );

          client.emit('session:confirmed', {
            sessionId: confirmed.id,
            startedAt: confirmed.startedAt,
            taskTitle: session.task.title,
            placeName: place.name,
            message: 'تم تأكيد موقعك — بدأت جلسة التطوع',
          });

          this.server.to('admin-live-map').emit('admin:session-activated', {
            volunteerId: data.volunteerId,
            sessionId: confirmed.id,
            taskTitle: session.task.title,
            lat,
            lng,
          });
        } catch (err) {
          this.logger.error(
            `Failed to confirm arrival for session ${session.id}`,
            err,
          );
        }
      }
    } else if (session.status === 'active') {
      try {
        await this.sessionsService.logGpsPing(session.id, data.volunteerId, {
          lat,
          lng,
        });
      } catch (err) {
        this.logger.error(
          `Failed to log GPS ping for session ${session.id}`,
          err,
        );
      }
    }
  }
}
