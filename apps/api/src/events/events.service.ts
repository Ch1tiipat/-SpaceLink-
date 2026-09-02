import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BoothStatus,
  EventStatus,
  OrgStatus,
  Prisma,
  type Subscription,
  SubscriptionStatus,
} from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { decimalString } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_BILLING_CONFIG } from '../platform-config/platform-config.service';

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
];

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createEventDto: CreateEventDto, organizationId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const quote = await this.buildSubscriptionQuote(
        transaction,
        createEventDto,
        organizationId,
      );
      if (
        createEventDto.expectedFinalPrice !== undefined &&
        !quote.finalPrice.equals(createEventDto.expectedFinalPrice)
      ) {
        throw new BadRequestException(
          'Subscription price changed; calculate a new quote before creating the event',
        );
      }
      const event = await transaction.event.create({
        data: {
          organizationId,
          venueId: createEventDto.venueId,
          name: createEventDto.name,
          description: createEventDto.description,
          startDate: dateValue(createEventDto.startDate),
          endDate: dateValue(createEventDto.endDate),
          startTime: createEventDto.startTime,
          endTime: createEventDto.endTime,
          contactPhone: createEventDto.contactPhone,
          contactEmail: createEventDto.contactEmail,
          status: EventStatus.DRAFT,
        },
      });
      const subscription = await transaction.subscription.create({
        data: {
          organizationId,
          eventId: event.id,
          status: SubscriptionStatus.DRAFT,
          baseFee: quote.values.baseFee,
          zoneCount: quote.zoneCount,
          perZoneRate: quote.values.perZoneRate,
          eventDays: quote.eventDays,
          perDayRate: quote.values.perDayRate,
          calculatedPrice: quote.calculatedPrice,
          priceMin: quote.values.priceMin,
          priceMax: quote.values.priceMax,
          finalPrice: quote.finalPrice,
          isOverMax: quote.isOverMax,
        },
      });

      return {
        ...event,
        venue: quote.venue,
        subscription: serializeSubscription(subscription),
      };
    });
  }

  quoteSubscription(createEventDto: CreateEventDto, organizationId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const quote = await this.buildSubscriptionQuote(
        transaction,
        createEventDto,
        organizationId,
      );
      return serializeQuote(quote);
    });
  }

  findAll() {
    return this.prisma.event.findMany();
  }

  async findByOrganization(organizationId: string) {
    const events = await this.prisma.event.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
      include: {
        venue: { select: { id: true, name: true } },
        subscription: true,
      },
    });

    return events.map((event) => ({
      ...event,
      subscription: event.subscription
        ? serializeSubscription(event.subscription)
        : null,
    }));
  }

  private async buildSubscriptionQuote(
    transaction: Prisma.TransactionClient,
    input: CreateEventDto,
    organizationId: string,
  ) {
    const eventDays = inclusiveDays(input.startDate, input.endDate);
    const venue = await transaction.venue.findFirst({
      where: { id: input.venueId, organizationId },
      select: { id: true, name: true },
    });
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    const [zoneCount, storedConfig] = await Promise.all([
      transaction.zone.count({ where: { venueId: input.venueId } }),
      transaction.platformConfig.findFirst({
        orderBy: { createdAt: 'asc' },
        select: {
          baseFee: true,
          perZoneRate: true,
          perDayRate: true,
          priceMin: true,
          priceMax: true,
        },
      }),
    ]);
    const values = {
      baseFee: decimal(storedConfig?.baseFee ?? DEFAULT_BILLING_CONFIG.baseFee),
      perZoneRate: decimal(
        storedConfig?.perZoneRate ?? DEFAULT_BILLING_CONFIG.perZoneRate,
      ),
      perDayRate: decimal(
        storedConfig?.perDayRate ?? DEFAULT_BILLING_CONFIG.perDayRate,
      ),
      priceMin: decimal(
        storedConfig?.priceMin ?? DEFAULT_BILLING_CONFIG.priceMin,
      ),
      priceMax: decimal(
        storedConfig?.priceMax ?? DEFAULT_BILLING_CONFIG.priceMax,
      ),
    };
    const calculatedPrice = values.baseFee
      .plus(values.perZoneRate.times(zoneCount))
      .plus(values.perDayRate.times(eventDays));
    const finalPrice = Prisma.Decimal.max(
      values.priceMin,
      Prisma.Decimal.min(calculatedPrice, values.priceMax),
    );

    return {
      venue,
      zoneCount,
      eventDays,
      values,
      calculatedPrice,
      finalPrice,
      isOverMax: calculatedPrice.greaterThan(values.priceMax),
    };
  }

  async findDiscovery() {
    const events = await this.prisma.event.findMany({
      where: {
        status: { in: [EventStatus.PUBLISHED, EventStatus.ONGOING] },
        organization: { status: OrgStatus.ACTIVE },
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
        organization: { status: OrgStatus.ACTIVE },
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

  async publish(id: string, orgId: string) {
    const result = await this.prisma.event.updateMany({
      where: {
        id,
        organizationId: orgId,
        status: EventStatus.DRAFT,
      },
      data: { status: EventStatus.PUBLISHED },
    });

    if (result.count === 0) {
      const existing = await this.prisma.event.findFirst({
        where: { id, organizationId: orgId },
        select: { status: true },
      });
      if (!existing) {
        throw new NotFoundException('Event not found');
      }
      throw new BadRequestException('Only draft events can be published');
    }

    const event = await this.prisma.event.findFirst({
      where: { id, organizationId: orgId },
      include: {
        venue: { select: { id: true, name: true } },
        subscription: true,
      },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return {
      ...event,
      subscription: event.subscription
        ? serializeSubscription(event.subscription)
        : null,
    };
  }

  open(id: string, orgId: string) {
    return this.transitionStatus(
      id,
      orgId,
      EventStatus.CANCELLED,
      EventStatus.PUBLISHED,
      'Only cancelled events can be opened',
    );
  }

  close(id: string, orgId: string) {
    return this.transitionStatus(
      id,
      orgId,
      [EventStatus.PUBLISHED, EventStatus.ONGOING],
      EventStatus.CANCELLED,
      'Only published or ongoing events can be closed',
    );
  }

  async remove(id: string, orgId: string) {
    try {
      return await this.prisma.event.delete({
        where: {
          id,
          organizationId: orgId,
          bookings: { none: {} },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        const existing = await this.prisma.event.findFirst({
          where: { id, organizationId: orgId },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException(
            'ไม่สามารถลบอีเวนต์นี้ได้เนื่องจากมีประวัติการจองที่เกี่ยวข้องอยู่',
          );
        }
        throw new NotFoundException('Event not found');
      }
      throw error;
    }
  }

  private async transitionStatus(
    id: string,
    orgId: string,
    from: EventStatus | EventStatus[],
    to: EventStatus,
    invalidStatusMessage: string,
  ) {
    const result = await this.prisma.event.updateMany({
      where: {
        id,
        organizationId: orgId,
        status: Array.isArray(from) ? { in: from } : from,
      },
      data: { status: to },
    });

    if (result.count === 0) {
      const existing = await this.prisma.event.findFirst({
        where: { id, organizationId: orgId },
        select: { status: true },
      });
      if (!existing) {
        throw new NotFoundException('Event not found');
      }
      throw new BadRequestException(invalidStatusMessage);
    }

    const event = await this.prisma.event.findFirst({
      where: { id, organizationId: orgId },
      include: {
        venue: { select: { id: true, name: true } },
        subscription: true,
      },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return {
      ...event,
      subscription: event.subscription
        ? serializeSubscription(event.subscription)
        : null,
    };
  }
}

type SubscriptionQuoteCalculation = {
  venue: { id: string; name: string };
  zoneCount: number;
  eventDays: number;
  values: {
    baseFee: Prisma.Decimal;
    perZoneRate: Prisma.Decimal;
    perDayRate: Prisma.Decimal;
    priceMin: Prisma.Decimal;
    priceMax: Prisma.Decimal;
  };
  calculatedPrice: Prisma.Decimal;
  finalPrice: Prisma.Decimal;
  isOverMax: boolean;
};

function inclusiveDays(startValue: string, endValue: string): number {
  const start = dateValue(startValue);
  const end = dateValue(endValue);
  const difference = end.getTime() - start.getTime();
  if (difference < 0) {
    throw new BadRequestException('endDate must be on or after startDate');
  }
  return Math.floor(difference / 86_400_000) + 1;
}

function dateValue(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Invalid event date');
  }
  return date;
}

function decimal(value: string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function serializeQuote(quote: SubscriptionQuoteCalculation) {
  return {
    baseFee: quote.values.baseFee.toString(),
    zoneCount: quote.zoneCount,
    perZoneRate: quote.values.perZoneRate.toString(),
    eventDays: quote.eventDays,
    perDayRate: quote.values.perDayRate.toString(),
    calculatedPrice: quote.calculatedPrice.toString(),
    priceMin: quote.values.priceMin.toString(),
    priceMax: quote.values.priceMax.toString(),
    finalPrice: quote.finalPrice.toString(),
    isOverMax: quote.isOverMax,
  };
}

function serializeSubscription(subscription: Subscription) {
  return {
    ...subscription,
    baseFee: subscription.baseFee.toString(),
    perZoneRate: subscription.perZoneRate.toString(),
    perDayRate: subscription.perDayRate.toString(),
    calculatedPrice: subscription.calculatedPrice.toString(),
    priceMin: subscription.priceMin.toString(),
    priceMax: subscription.priceMax.toString(),
    finalPrice: subscription.finalPrice.toString(),
  };
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
