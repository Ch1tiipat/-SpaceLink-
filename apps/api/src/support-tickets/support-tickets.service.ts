import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TicketStatus, TicketType } from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service';
import type { BookingResponse } from '../bookings/bookings.service';
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
  private readonly logger = new Logger(SupportTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
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
   * held at once per approval, which is how a small pool deadlocks. The booking
   * is therefore committed before the ticket is updated; the `closed.count === 0`
   * branch below says what that costs.
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
    const booking = await this.bookingsService.createForAdmin(
      {
        eventId: approveQuotaExceptionDto.eventId,
        boothId: approveQuotaExceptionDto.boothId,
        shopId: shop.id,
      },
      ticket.userId,
    );

    const closed = await this.prisma.supportTicket.updateMany({
      where: {
        id: ticketId,
        status: { in: ACTIONABLE_TICKET_STATUSES },
      },
      data: {
        status: TicketStatus.CLOSED,
        bookingId: booking.id,
      },
    });

    if (closed.count === 0) {
      // Two admins approved the same ticket at once and the other one closed it
      // first. The booking above is already committed and is a real, valid
      // booking — it just is not the one the ticket points at. Deleting it is
      // not an option this codebase has a precedent for, and refusing here
      // would hide a booking that exists from the admin who made it, so the
      // booking is returned and the divergence is left where a human can see
      // it. The booth-level unique check means the two approvals cannot both
      // have taken the same booth.
      this.logger.warn(
        `Quota exception ${ticketId} was already closed by a concurrent ` +
          `approval; booking ${booking.id} is not linked to it`,
      );
    }

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
