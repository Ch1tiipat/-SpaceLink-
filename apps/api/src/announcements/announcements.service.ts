import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  findPublic(organizationId: string) {
    return this.prisma.announcement.findMany({
      where: { organizationId, isActive: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  findAllForAdmin(organizationId: string) {
    return this.prisma.announcement.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllAcrossOrganizations() {
    return this.prisma.announcement.findMany({
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  removeAcrossOrganizations(id: string) {
    return this.prisma.announcement.delete({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async create(
    organizationId: string,
    createAnnouncementDto: CreateAnnouncementDto,
  ) {
    const announcement = await this.prisma.announcement.create({
      data: { ...createAnnouncementDto, organizationId },
    });

    if (announcement.isActive) {
      await this.notifyBookers(organizationId, announcement);
    }

    return announcement;
  }

  async update(
    id: string,
    updateAnnouncementDto: UpdateAnnouncementDto,
    organizationId: string,
  ) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id, organizationId },
      select: { isActive: true },
    });
    const announcement = await this.prisma.announcement.update({
      where: { id, organizationId },
      data: updateAnnouncementDto,
    });

    if (existing?.isActive === false && announcement.isActive) {
      await this.notifyBookers(organizationId, announcement);
    }

    return announcement;
  }

  remove(id: string, organizationId: string) {
    return this.prisma.announcement.delete({
      where: { id, organizationId },
    });
  }

  private notifyBookers(
    organizationId: string,
    announcement: { id: string; title: string; body: string },
  ) {
    return this.notifications.fanOutToOrganizationBookers(organizationId, {
      type: NotificationType.ANNOUNCEMENT,
      title: announcement.title,
      body: this.excerpt(announcement.body),
      relatedEntityType: 'ANNOUNCEMENT',
      relatedEntityId: announcement.id,
    });
  }

  private excerpt(body: string): string {
    if (body.length <= 200) return body;
    return `${body.slice(0, 199).trimEnd()}…`;
  }
}
