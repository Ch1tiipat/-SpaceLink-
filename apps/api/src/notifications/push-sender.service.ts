import { Injectable, Logger } from '@nestjs/common';
import type { PushSubscription } from '@prisma/client';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);
  private readonly enabled = Boolean(process.env.VAPID_PRIVATE_KEY);

  constructor(private readonly prisma: PrismaService) {
    if (this.enabled) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT!,
        process.env.VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!,
      );
    }
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
      });
      await Promise.allSettled(
        subscriptions.map((subscription) =>
          this.sendOne(subscription, payload),
        ),
      );
    } catch {
      this.logger.error('Failed to send web push notifications');
    }
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    try {
      await Promise.allSettled(
        userIds.map((userId) => this.sendToUser(userId, payload)),
      );
    } catch {
      this.logger.error('Failed to send web push notifications');
    }
  }

  private async sendOne(
    subscription: PushSubscription,
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dhKey,
            auth: subscription.authKey,
          },
        },
        JSON.stringify(payload),
      );
    } catch (error: unknown) {
      const statusCode = this.statusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        await this.prisma.pushSubscription
          .deleteMany({ where: { endpoint: subscription.endpoint } })
          .catch(() => undefined);
      }
    }
  }

  private statusCode(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    if (!('statusCode' in error)) return undefined;
    return typeof error.statusCode === 'number' ? error.statusCode : undefined;
  }
}
