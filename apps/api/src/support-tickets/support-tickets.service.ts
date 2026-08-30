import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

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
 * The vendor-facing half of the booking-quota exception: a vendor who has hit
 * the per-event quota (BookingsService, invariant §6.3.6) raises a ticket, and
 * an admin of the organization hosting that event approves it by creating the
 * booking directly.
 *
 * The ticket carries no structured request — `SupportTicket` has no column for
 * an event or a booth and the schema is frozen (§2.1) — so the *approving*
 * admin names the event and booth in `ApproveQuotaExceptionDto`. The ticket's
 * `subject` and first message are how the vendor says which booth they want;
 * the admin reads them and decides. Nothing a vendor sends here picks a booth
 * on its own.
 */
@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The organization is taken from the event, never from the vendor's request
   * (§14.2) — the vendor names an event, and which organization that belongs to
   * is ours to decide. It is what OrgScopeGuard later resolves the ticket to,
   * so a vendor cannot raise a ticket into an organization of their choosing.
   */
  async create(
    createSupportTicketDto: CreateSupportTicketDto,
    vendorUserId: string,
  ): Promise<SupportTicketResponse> {
    const { eventId, subject, message } = createSupportTicketDto;

    const ticket = await this.prisma.$transaction(async (transaction) => {
      const event = await transaction.event.findUnique({
        where: { id: eventId },
        select: { organizationId: true },
      });
      if (!event) {
        throw new NotFoundException('ไม่พบอีเวนต์');
      }

      const created = await transaction.supportTicket.create({
        data: {
          userId: vendorUserId,
          organizationId: event.organizationId,
          // Filled in by approveQuotaException once a booking exists. There is
          // no booking to link at the moment the vendor asks for one.
          bookingId: null,
          // TicketType has no quota-exception member and the schema is frozen
          // (§2.1), so OTHER is the honest choice — the subject and the first
          // message carry what this is actually about.
          type: TicketType.OTHER,
          subject,
          status: TicketStatus.OPEN,
        },
        select: supportTicketSelect,
      });

      await transaction.ticketMessage.create({
        data: {
          ticketId: created.id,
          senderUserId: vendorUserId,
          message,
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
}
