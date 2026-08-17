import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(organizationId: string, createAnnouncementDto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: { ...createAnnouncementDto, organizationId },
    });
  }

  update(
    id: string,
    updateAnnouncementDto: UpdateAnnouncementDto,
    organizationId: string,
  ) {
    return this.prisma.announcement.update({
      where: { id, organizationId },
      data: updateAnnouncementDto,
    });
  }

  remove(id: string, organizationId: string) {
    return this.prisma.announcement.delete({
      where: { id, organizationId },
    });
  }
}
