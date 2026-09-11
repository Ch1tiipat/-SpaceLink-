import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventInformationDto } from './dto/create-event-information.dto';
import { UpdateEventInformationDto } from './dto/update-event-information.dto';

@Injectable()
export class EventInformationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    eventId: string,
    organizationId: string,
    input: CreateEventInformationDto,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const lastItem = await this.prisma.eventInformation.findFirst({
      where: { eventId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return this.prisma.eventInformation.create({
      data: {
        eventId,
        title: input.title,
        description: input.description,
        type: input.type,
        sortOrder: (lastItem?.sortOrder ?? -1) + 1,
      },
    });
  }

  async update(
    eventId: string,
    informationId: string,
    organizationId: string,
    input: UpdateEventInformationDto,
  ) {
    await this.requireOwnedItem(eventId, informationId, organizationId);
    return this.prisma.eventInformation.update({
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
      const removed = await transaction.eventInformation.delete({
        where: { id: informationId },
      });
      await transaction.eventInformation.updateMany({
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

    const existing = await this.prisma.eventInformation.findMany({
      where: { eventId },
      select: { id: true },
    });
    const requested = new Set(ids);
    if (
      ids.length !== existing.length ||
      existing.some((item) => !requested.has(item.id))
    ) {
      throw new BadRequestException(
        'รายการจัดลำดับต้องตรงกับรายละเอียดทั้งหมดของอีเวนต์',
      );
    }

    await this.prisma.$transaction(
      ids.map((id, sortOrder) =>
        this.prisma.eventInformation.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );
    return this.prisma.eventInformation.findMany({
      where: { eventId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async requireOwnedItem(
    eventId: string,
    informationId: string,
    organizationId: string,
  ) {
    const item = await this.prisma.eventInformation.findFirst({
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
