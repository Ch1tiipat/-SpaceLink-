import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, BoothStatus, Prisma } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createEventDto: CreateEventDto) {
    return this.prisma.event.create({
      data: createEventDto as Prisma.EventUncheckedCreateInput,
    });
  }

  findAll() {
    return this.prisma.event.findMany();
  }

  findOne(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }

  /**
   * Public-safe data used by the vendor zone map.
   *
   * Booking records are deliberately reduced to an availability label. The
   * browser must never receive another vendor's booking id or personal data
   * just to colour a booth on the map.
   */
  async findMap(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        policy: {
          select: {
            generalRules: true,
            cancellationPolicy: true,
            refundPolicy: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const zones = await this.prisma.zone.findMany({
      where: { venueId: event.venueId },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        posX: true,
        posY: true,
        categories: {
          select: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
        booths: {
          orderBy: { code: 'asc' },
          select: {
            id: true,
            zoneId: true,
            code: true,
            boothPrice: true,
            widthM: true,
            heightM: true,
            posX: true,
            posY: true,
            status: true,
            bookings: {
              where: {
                eventId: id,
                status: { in: ACTIVE_BOOKING_STATUSES },
              },
              select: { status: true },
              take: 1,
            },
          },
        },
      },
    });

    return {
      event,
      zones: zones.map((zone) => ({
        id: zone.id,
        code: zone.code,
        name: zone.name,
        description: zone.description,
        posX: decimalString(zone.posX),
        posY: decimalString(zone.posY),
        categories: zone.categories.map(({ category }) => category),
        booths: zone.booths.map((booth) => ({
          id: booth.id,
          zoneId: booth.zoneId,
          code: booth.code,
          boothPrice: booth.boothPrice.toString(),
          widthM: decimalString(booth.widthM),
          heightM: decimalString(booth.heightM),
          posX: decimalString(booth.posX),
          posY: decimalString(booth.posY),
          availability: boothAvailability(booth.status, booth.bookings),
        })),
      })),
    };
  }

  update(id: string, updateEventDto: UpdateEventDto) {
    return this.prisma.event.update({
      where: { id },
      data: updateEventDto,
    });
  }

  remove(id: string) {
    return this.prisma.event.delete({
      where: { id },
    });
  }
}

function boothAvailability(
  status: BoothStatus,
  bookings: { status: BookingStatus }[],
): 'AVAILABLE' | 'HELD' | 'BOOKED' | 'UNAVAILABLE' {
  if (status !== BoothStatus.AVAILABLE) {
    return 'UNAVAILABLE';
  }

  if (bookings.some((booking) => booking.status === BookingStatus.CONFIRMED)) {
    return 'BOOKED';
  }

  if (
    bookings.some((booking) => booking.status === BookingStatus.PENDING_PAYMENT)
  ) {
    return 'HELD';
  }

  return 'AVAILABLE';
}

function decimalString(value: Prisma.Decimal | null): string | null {
  return value?.toString() ?? null;
}
