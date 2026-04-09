import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import { Notification } from './notification.entity.js';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseInitialized = false;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not configured — push notifications disabled',
      );
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      this.firebaseInitialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.logger.error('Failed to initialize Firebase Admin SDK', err);
    }
  }

  // ─── In-App Notifications ────────────────────────────────────────────

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

  // ─── FCM Push Notifications ──────────────────────────────────────────

  async sendPushToToken(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.firebaseInitialized || !fcmToken) return;

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });
      this.logger.log(`FCM sent to token: ${fcmToken.slice(0, 20)}...`);
    } catch (err: any) {
      // Token may be stale/invalid — log but don't throw
      this.logger.warn(`FCM send failed: ${err.message}`);
    }
  }

  async sendPushToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.firebaseInitialized) return;

    try {
      await admin.messaging().send({
        topic,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });
      this.logger.log(`FCM sent to topic: ${topic}`);
    } catch (err: any) {
      this.logger.warn(`FCM topic send failed: ${err.message}`);
    }
  }

  // ─── Domain-Specific Methods ─────────────────────────────────────────

  async sendApplicationResult(
    userId: string,
    fcmToken: string | null,
    status: 'approved' | 'rejected' | 'banned',
    data?: Record<string, string>,
  ): Promise<void> {
    const messages: Record<string, { title: string; body: string }> = {
      approved: {
        title: 'تمت الموافقة على طلبك',
        body: 'مبروك! تم قبولك كمتطوع في صندوق مكافحة الإدمان',
      },
      rejected: {
        title: 'تم رفض طلبك',
        body: 'نأسف، لم يتم قبول طلب التطوع الخاص بك',
      },
      banned: {
        title: 'تم حظر حسابك',
        body: 'تم حظر حسابك من التطوع. تواصل مع الإدارة لمزيد من التفاصيل',
      },
    };

    const msg = messages[status];

    // Save in-app notification
    await this.createForUser(userId, msg.title, msg.body, 'application_status', {
      status,
      ...data,
    });

    // Send FCM push
    if (fcmToken) {
      await this.sendPushToToken(fcmToken, msg.title, msg.body, {
        type: 'application_status',
        status,
        ...data,
      });
    }
  }

  async sendAnnouncementNotification(
    group: string | null,
    title: string,
    body: string,
    announcementId: string,
  ): Promise<void> {
    const topic = group ? `group_${group}` : 'all_volunteers';

    await this.sendPushToTopic(topic, title, body, {
      type: 'announcement',
      announcementId,
    });
  }

  async subscribeToGroupTopic(
    fcmToken: string,
    group: string,
  ): Promise<void> {
    if (!this.firebaseInitialized || !fcmToken) return;

    try {
      await admin.messaging().subscribeToTopic([fcmToken], `group_${group}`);
      await admin.messaging().subscribeToTopic([fcmToken], 'all_volunteers');
      this.logger.log(`Subscribed token to group_${group} and all_volunteers`);
    } catch (err: any) {
      this.logger.warn(`FCM topic subscribe failed: ${err.message}`);
    }
  }
}
