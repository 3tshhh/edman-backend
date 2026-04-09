import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../../common/services/token.service.js';
import { UserService } from '../user/user.service.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';
import { UserRole, VolunteerGroup } from '../../common/constants/enums.js';

@WebSocketGateway({ cors: true, namespace: '/notifications' })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => VolunteersService))
    private readonly volunteersService: VolunteersService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.replace('Bearer ', '') ?? '');

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

      // Admin token — admins don't need notification rooms
      if (verified.role === 'admin' && verified.adminId) {
        client.data = { userId: verified.adminId, role: 'admin' };
        this.logger.log(`Admin notifications client connected: ${verified.adminId}`);
        return;
      }

      // Volunteer/User token
      const user = await this.userService.findById(verified.userId);
      if (!user) {
        client.disconnect();
        return;
      }

      if (user.role === UserRole.VOLUNTEER) {
        const volunteer = await this.volunteersService.findByUserId(user.id);
        if (volunteer?.volunteerGroup) {
          client.join(`group:${volunteer.volunteerGroup}`);
          client.join('all-volunteers');
        }
      }

      client.data = { userId: user.id, role: user.role };
      this.logger.log(`Notifications client connected: ${user.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId;
    if (userId) {
      this.logger.log(`Notifications client disconnected: ${userId}`);
    }
  }

  emitToGroup(group: VolunteerGroup, event: string, payload: object): void {
    this.server.to(`group:${group}`).emit(event, payload);
  }

  emitToAll(event: string, payload: object): void {
    this.server.to('all-volunteers').emit(event, payload);
  }
}
