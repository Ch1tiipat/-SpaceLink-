import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';

const publicSubscriptionSelect = {
  id: true,
  endpoint: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

@Injectable()
export class PushSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  upsert(userId: string, input: CreatePushSubscriptionDto, userAgent?: string) {
    const data = {
      userId,
      p256dhKey: input.keys.p256dh,
      authKey: input.keys.auth,
      userAgent: userAgent ?? null,
    };

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { endpoint: input.endpoint, ...data },
      update: data,
      select: publicSubscriptionSelect,
    });
  }

  delete(userId: string, endpoint: string): Promise<{ count: number }> {
    return this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
  }
}
