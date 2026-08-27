import { Injectable } from '@nestjs/common';
import type { SystemBroadcast } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSystemBroadcastDto } from './dto/create-system-broadcast.dto';

@Injectable()
export class SystemBroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    createdBy: string,
    input: CreateSystemBroadcastDto,
  ): Promise<SystemBroadcast> {
    const broadcast = await this.prisma.systemBroadcast.create({
      data: {
        title: input.title,
        body: input.body,
        createdBy,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    await this.notifications
      .broadcastToAllUsers({ title: input.title, body: input.body })
      .catch(() => 0);

    return broadcast;
  }

  async findActive(): Promise<SystemBroadcast | null> {
    const latest = await this.prisma.systemBroadcast.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) return null;
    if (latest.expiresAt && latest.expiresAt <= new Date()) return null;

    return latest;
  }
}
