import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async getUnread(
    userId: string,
  ): Promise<{ count: number; items: Notification[] }> {
    const [items, count] = await this.notificationRepository.findAndCount({
      where: { user: { id: userId }, isRead: false },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return { count, items };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });
    if (!notification) {
      throw new NotFoundException('الإشعار غير موجود');
    }
    notification.isRead = true;
    await this.notificationRepository.save(notification);
  }

  async createForUser(
    userId: string,
    title: string,
    body: string,
    type?: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      user: { id: userId } as any,
      title,
      body,
      type: type ?? null,
      metadata: metadata ?? null,
    });
    return this.notificationRepository.save(notification);
  }

  async sendOtpToPhone(phone: string, code: string): Promise<void> {
    // TODO: Production — use Firebase Admin SDK
    console.log(`[OTP] Phone: ${phone}, Code: ${code}`);
  }

  async sendApplicationResult(
    fcmToken: string | null,
    status: string,
    data?: Record<string, any>,
  ): Promise<void> {
    // TODO: Production — use Firebase Admin SDK
    console.log(`[FCM] Token: ${fcmToken}, Status: ${status}`, data);
  }

  async sendToGroup(group: string, title: string, body: string): Promise<void> {
    // TODO: Production — use Firebase Admin SDK for topic messaging
    console.log(`[FCM Group] Group: ${group}, Title: ${title}`);
  }
}
