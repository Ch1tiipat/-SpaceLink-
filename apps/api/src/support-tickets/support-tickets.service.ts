import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BoothStatus,
  NotificationType,
  Prisma,
  TicketStatus,
  TicketType,
} from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service';
import type { BookingResponse } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveQuotaExceptionDto } from './dto/approve-quota-exception.dto';
import {
  CreateSupportTicketDto,
  SupportTicketRequestType,
} from './dto/create-support-ticket.dto';

/**
 * A ticket an admin may still act on. CLOSED is deliberately absent: closing is
 * what approving does, so a closed ticket has either been approved already or
 * been settled some other way.
 */
const ACTIONABLE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.PROCESSING,
];

const supportTicketSelect = {
  id: true,
  userId: true,
  organizationId: true,
  bookingId: true,
  type: true,
  subject: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupportTicketSelect;

type SupportTicketRecord = Prisma.SupportTicketGetPayload<{
  select: typeof supportTicketSelect;
}>;

export interface SupportTicketResponse {
  id: string;
  userId: string;
  organizationId: string | null;
  bookingId: string | null;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketOverviewSelect = {
  id: true,
  type: true,
  subject: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, fullName: true } },
  organization: { select: { id: true, name: true } },
} satisfies Prisma.SupportTicketSelect;

export type SupportTicketOverviewResponse = Prisma.SupportTicketGetPayload<{
  select: typeof supportTicketOverviewSelect;
}>;

/**
 * Vendor support covers quota-increase requests and issue reports. A quota
 * request stays TicketType.OTHER because the frozen enum has no quota member;
 * its validated event, zone and reference booth context is preserved in the
 * first message. An issue report uses TicketType.ISSUE_REPORT and may link an
 * owned booking. Neither path trusts an organization id from the browser.
 */
@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Derives organization and booking context from vendor-owned records. */
  async create(
    createSupportTicketDto: CreateSupportTicketDto,
    vendorUserId: string,
  ): Promise<SupportTicketResponse> {
    const { requestType, subject, message } = createSupportTicketDto;

    const ticket = await this.prisma.$transaction(async (transaction) => {
      let organizationId: string | null = null;
      let bookingId: string | null = null;
      let type: TicketType = TicketType.ISSUE_REPORT;
      let contextualMessage = message;

      if (requestType === SupportTicketRequestType.QUOTA_INCREASE) {
        const eventId = createSupportTicketDto.eventId;
        const zoneId = createSupportTicketDto.zoneId;
        const boothId = createSupportTicketDto.boothId;
        if (!eventId || !zoneId || !boothId) {
          throw new NotFoundException('ไม่พบงาน โซน หรือบูธที่เลือก');
        }

        const bookings = await transaction.booking.findMany({
          where: {
            vendorUserId,
            eventId,
            status: {
              in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
            },
            booth: { zoneId },
          },
          select: {
            bookingCode: true,
            event: { select: { name: true, organizationId: true } },
            booth: {
              select: {
                code: true,
                zone: { select: { code: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
        if (bookings.length === 0) {
          throw new NotFoundException('ไม่พบการจองของคุณในงานและโซนที่เลือก');
        }

        const requestedBooth = await transaction.booth.findFirst({
          where: {
            id: boothId,
            zoneId,
            status: BoothStatus.AVAILABLE,
          },
          select: {
            id: true,
            code: true,
            widthM: true,
            heightM: true,
          },
        });
        if (!requestedBooth) {
          throw new NotFoundException('ไม่พบบูธที่เลือกในโซนนี้');
        }

        const occupiedBooking = await transaction.booking.findFirst({
          where: {
            eventId,
            boothId: requestedBooth.id,
            status: {
              in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
            },
          },
          select: { id: true },
        });
        if (occupiedBooking) {
          throw new ConflictException(
            'บูธที่เลือกไม่ว่างแล้ว กรุณาเลือกบูธอื่น',
          );
        }

        const context = bookings[0];
        organizationId = context.event.organizationId;
        type = TicketType.OTHER;
        contextualMessage = [
          'ประเภทคำร้อง: ขอโควต้าบูธเพิ่ม',
          `งาน: ${context.event.name}`,
          `โซน: ${context.booth.zone.name ?? context.booth.zone.code}`,
          `บูธที่ต้องการเพิ่ม: ${requestedBooth.code} (${this.formatBoothSize(
            requestedBooth.widthM,
            requestedBooth.heightM,
          )})`,
          `บูธปัจจุบัน: ${bookings
            .map((booking) => `${booking.booth.code} (${booking.bookingCode})`)
            .join(', ')}`,
          '',
          message,
        ].join('\n');
      } else if (createSupportTicketDto.bookingId) {
        const booking = await transaction.booking.findFirst({
          where: {
            id: createSupportTicketDto.bookingId,
            vendorUserId,
          },
          select: {
            id: true,
            bookingCode: true,
            event: { select: { name: true, organizationId: true } },
            booth: {
              select: {
                code: true,
                zone: { select: { code: true, name: true } },
              },
            },
          },
        });
        if (!booking) {
          throw new NotFoundException('ไม่พบการจองที่เลือก');
        }

        organizationId = booking.event.organizationId;
        bookingId = booking.id;
        contextualMessage = [
          'ประเภทคำร้อง: ติดต่อปัญหา',
          `การจอง: ${booking.bookingCode}`,
          `งาน: ${booking.event.name}`,
          `โซน: ${booking.booth.zone.name ?? booking.booth.zone.code}`,
          `บูธ: ${booking.booth.code}`,
          '',
          message,
        ].join('\n');
      }

      const created = await transaction.supportTicket.create({
        data: {
          userId: vendorUserId,
          organizationId,
          bookingId,
          type,
          subject,
          status: TicketStatus.OPEN,
        },
        select: supportTicketSelect,
      });

      await transaction.ticketMessage.create({
        data: {
          ticketId: created.id,
          senderUserId: vendorUserId,
          message: contextualMessage,
        },
      });

      return created;
    });

    return this.toResponse(ticket);
  }

  async findAllAcrossOrganizations(): Promise<SupportTicketOverviewResponse[]> {
    return this.prisma.supportTicket.findMany({
      select: supportTicketOverviewSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approves a quota exception by creating the booking the vendor could not
   * create themselves, then closing the ticket against it.
   *
   * `orgId` comes from `@CurrentOrgId()`, which OrgScopeGuard already derived
   * from this exact ticket's own `organizationId` — so the filter below cannot
   * exclude a row the guard allowed. It is the same forcing function as
   * `BookingsService.findOne`: a caller must supply an `orgId` to compile, and
   * the only sanctioned source throws the moment `@OrgScoped` is missing from
   * the route.
   *
   * **This is deliberately not one transaction.** `createForAdmin` opens its
   * own serializable transaction and retries it on a write conflict; running
   * that inside an outer interactive transaction would mean two connections
   * held at once per approval, which is how a small pool deadlocks. Instead,
   * an atomic status update claims the ticket before the booking is created.
   * A failed booking restores the ticket's previous actionable status.
   */
  async approveQuotaException(
    ticketId: string,
    approveQuotaExceptionDto: ApproveQuotaExceptionDto,
    orgId: string,
  ): Promise<BookingResponse> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId: orgId },
      select: { id: true, userId: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException('ไม่พบคำร้อง');
    }
    if (!ACTIONABLE_TICKET_STATUSES.includes(ticket.status)) {
      throw new ConflictException('คำร้องนี้ถูกปิดไปแล้ว');
    }

    const claimed = await this.prisma.supportTicket.updateMany({
      where: {
        id: ticketId,
        organizationId: orgId,
        status: { in: ACTIONABLE_TICKET_STATUSES },
      },
      data: { status: TicketStatus.CLOSED },
    });
    if (claimed.count === 0) {
      throw new ConflictException('คำร้องนี้ถูกปิดไปแล้ว');
    }

    let booking: BookingResponse;
    try {
      const shop = await this.prisma.shop.findFirst({
        where: { ownerUserId: ticket.userId },
        select: { id: true },
      });
      if (!shop) {
        throw new NotFoundException('ไม่พบร้านค้าของผู้ใช้');
      }

      // Everything a booking must satisfy is still checked in here — booth
      // availability, the venue match, the date range, no second active booking
      // on this (event, booth). Only the quota is waived, and anything this
      // throws is the caller's answer unchanged.
      booking = await this.bookingsService.createForAdmin(
        {
          eventId: approveQuotaExceptionDto.eventId,
          boothId: approveQuotaExceptionDto.boothId,
          shopId: shop.id,
        },
        ticket.userId,
        orgId,
      );
    } catch (error) {
      await this.prisma.supportTicket.update({
        where: { id: ticketId, organizationId: orgId },
        data: { status: ticket.status },
      });
      throw error;
    }

    await this.prisma.supportTicket.update({
      where: { id: ticketId, organizationId: orgId },
      data: { bookingId: booking.id },
    });

    await this.notifications.createForUser(ticket.userId, {
      type: NotificationType.SUPPORT_TICKET,
      title: 'คำร้องขอยกเว้นโควตาได้รับการอนุมัติแล้ว',
      body: 'ระบบสร้างการจองให้คุณเรียบร้อยแล้ว',
      relatedEntityType: 'SUPPORT_TICKET',
      relatedEntityId: ticket.id,
    });

    return booking;
  }

  private toResponse(ticket: SupportTicketRecord): SupportTicketResponse {
    return {
      id: ticket.id,
      userId: ticket.userId,
      organizationId: ticket.organizationId,
      bookingId: ticket.bookingId,
      type: ticket.type,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  private formatBoothSize(
    widthM: Prisma.Decimal | null,
    heightM: Prisma.Decimal | null,
  ): string {
    return widthM && heightM
      ? `${widthM.toString()} × ${heightM.toString()} เมตร`
      : 'ไม่ระบุขนาด';
  }
}
