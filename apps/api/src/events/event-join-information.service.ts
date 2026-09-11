import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventJoinInformationDto } from './dto/create-event-join-information.dto';
import { UpdateEventJoinInformationDto } from './dto/update-event-join-information.dto';

@Injectable()
export class EventJoinInformationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    eventId: string,
    organizationId: string,
    input: CreateEventJoinInformationDto,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const lastItem = await this.prisma.eventJoinInformation.findFirst({
      where: { eventId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return this.prisma.eventJoinInformation.create({
      data: {
        eventId,
        title: input.title,
        content: input.content,
        sortOrder: (lastItem?.sortOrder ?? -1) + 1,
      },
    });
  }

  async update(
    eventId: string,
    informationId: string,
    organizationId: string,
    input: UpdateEventJoinInformationDto,
  ) {
    await this.requireOwnedItem(eventId, informationId, organizationId);
    return this.prisma.eventJoinInformation.update({
      where: { id: informationId },
      data: input,
    });
  }

  async remove(eventId: string, informationId: string, organizationId: string) {
    const existing = await this.requireOwnedItem(
      eventId,
      informationId,
      organizationId,
    );
    return this.prisma.$transaction(async (transaction) => {
      const removed = await transaction.eventJoinInformation.delete({
        where: { id: informationId },
      });
      await transaction.eventJoinInformation.updateMany({
        where: { eventId, sortOrder: { gt: existing.sortOrder } },
        data: { sortOrder: { decrement: 1 } },
      });
      return removed;
    });
  }

  async reorder(eventId: string, organizationId: string, ids: string[]) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.prisma.eventJoinInformation.findMany({
      where: { eventId },
      select: { id: true },
    });
    const requested = new Set(ids);
    if (
      ids.length !== existing.length ||
      existing.some((item) => !requested.has(item.id))
    ) {
      throw new BadRequestException(
        'รายการจัดลำดับต้องตรงกับข้อมูลก่อนเข้าร่วมงานทั้งหมดของอีเวนต์',
      );
    }

    await this.prisma.$transaction(
      ids.map((id, sortOrder) =>
        this.prisma.eventJoinInformation.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );
    return this.prisma.eventJoinInformation.findMany({
      where: { eventId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async requireOwnedItem(
    eventId: string,
    informationId: string,
    organizationId: string,
  ) {
    const item = await this.prisma.eventJoinInformation.findFirst({
      where: {
        id: informationId,
        eventId,
        event: { organizationId },
      },
      select: { id: true, sortOrder: true },
    });
    if (!item) throw new NotFoundException('Event information not found');
    return item;
  }
}
