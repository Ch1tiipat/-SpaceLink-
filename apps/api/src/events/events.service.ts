import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  BoothStatus,
  EventStatus,
  Prisma,
} from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { decimalString } from '../common/decimal';
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

  async findDiscovery() {
    const events = await this.prisma.event.findMany({
      where: {
        status: { in: [EventStatus.PUBLISHED, EventStatus.ONGOING] },
      },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        bannerUrl: true,
        status: true,
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            zones: {
              select: {
                categories: {
                  select: {
                    category: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return events.map(({ venue, ...event }) => ({
      ...event,
      venue: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
      },
      categories: uniqueCategories(
        venue.zones.flatMap((zone) =>
          zone.categories.map(({ category }) => category),
        ),
      ),
    }));
  }

  findOne(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }

  /**
   * Public-safe data used by the vendor zone map.
   *
   * Booking records are deliberately reduced to an availability label and,
   * for a confirmed booking only, the public shop identity used on the map.
   * The browser never receives another vendor's booking id or personal data.
   */
  async findMap(id: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id,
        status: { in: [EventStatus.PUBLISHED, EventStatus.ONGOING] },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
            contactPhone: true,
            logoUrl: true,
            orgConfig: {
              select: { tierThresholds: true },
            },
          },
        },
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
              select: {
                status: true,
                shop: {
                  select: { id: true, name: true, logoUrl: true },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    const { organization, ...publicEvent } = event;
    const tierThresholds = organization.orgConfig?.tierThresholds;

    return {
      event: {
        ...publicEvent,
        organization: {
          id: organization.id,
          name: organization.name,
          contactEmail: organization.contactEmail,
          contactPhone: organization.contactPhone,
          logoUrl: organization.logoUrl,
        },
      },
      zones: zones.map((zone) => ({
        id: zone.id,
        code: zone.code,
        name: zone.name,
        description: zone.description,
        posX: decimalString(zone.posX),
        posY: decimalString(zone.posY),
        categories: zone.categories.map(({ category }) => category),
        booths: zone.booths.map((booth) => {
          const confirmedBooking = booth.bookings.find(
            (booking) => booking.status === BookingStatus.CONFIRMED,
          );

          return {
            id: booth.id,
            zoneId: booth.zoneId,
            code: booth.code,
            boothPrice: booth.boothPrice.toString(),
            widthM: decimalString(booth.widthM),
            heightM: decimalString(booth.heightM),
            posX: decimalString(booth.posX),
            posY: decimalString(booth.posY),
            availability: boothAvailability(booth.status, booth.bookings),
            tier: boothTier(booth.boothPrice, tierThresholds),
            occupant: confirmedBooking?.shop ?? null,
          };
        }),
      })),
    };
  }

  /**
   * `orgId` is the organization the caller is scoped to. Unlike Zone, which
   * reaches its organization through `venue`, `Event.organizationId` is a
   * direct column, so the filter names it directly.
   *
   * No route calls this yet. The parameter is here so that whichever route
   * eventually does cannot compile without supplying an `orgId` — the only
   * sanctioned source is `@CurrentOrgId()`, which throws unless `@OrgScoped`
   * put the guards on the route. An unscoped write is the §14.2 failure that
   * shows up as a cross-tenant leak rather than as an error.
   *
   * A filtered-out row raises P2025, which PrismaExceptionFilter turns into
   * the same 404 a missing id gives, so there is nothing to catch here.
   */
  update(id: string, updateEventDto: UpdateEventDto, orgId: string) {
    return this.prisma.event.update({
      where: { id, organizationId: orgId },
      data: updateEventDto,
    });
  }

  remove(id: string, orgId: string) {
    return this.prisma.event.delete({
      where: { id, organizationId: orgId },
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

function uniqueCategories<T extends { id: string }>(categories: T[]): T[] {
  const seen = new Set<string>();
  return categories.filter((category) => {
    if (seen.has(category.id)) return false;
    seen.add(category.id);
    return true;
  });
}

type BoothTier = 'S' | 'A' | 'B' | 'C';

function boothTier(
  price: Prisma.Decimal,
  value: Prisma.JsonValue | null | undefined,
): BoothTier | null {
  const thresholds = parseTierThresholds(value);
  if (!thresholds) return null;

  if (price.greaterThanOrEqualTo(thresholds.S)) return 'S';
  if (price.greaterThanOrEqualTo(thresholds.A)) return 'A';
  if (price.greaterThanOrEqualTo(thresholds.B)) return 'B';
  return 'C';
}

function parseTierThresholds(
  value: Prisma.JsonValue | null | undefined,
): Record<'S' | 'A' | 'B', Prisma.Decimal> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, Prisma.JsonValue>;
  const s = threshold(source.S ?? source.s ?? source.sMin);
  const a = threshold(source.A ?? source.a ?? source.aMin);
  const b = threshold(source.B ?? source.b ?? source.bMin);

  if (!s || !a || !b || s.lessThan(a) || a.lessThan(b)) {
    return null;
  }

  return { S: s, A: a, B: b };
}

function threshold(value: Prisma.JsonValue | undefined): Prisma.Decimal | null {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  try {
    return new Prisma.Decimal(value);
  } catch {
    return null;
  }
}
