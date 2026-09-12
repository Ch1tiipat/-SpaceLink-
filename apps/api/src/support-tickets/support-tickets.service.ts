import {
  BadRequestException,
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
  UserRole,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveQuotaExceptionDto } from './dto/approve-quota-exception.dto';
import {
  CreateSupportTicketDto,
  SupportTicketRequestType,
} from './dto/create-support-ticket.dto';
import { RejectQuotaExceptionDto } from './dto/reject-quota-exception.dto';

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

const supportTicketDetailSelect = {
  ...supportTicketOverviewSelect,
  booking: {
    select: {
      id: true,
      bookingCode: true,
      event: { select: { id: true, name: true } },
      booth: {
        select: {
          id: true,
          code: true,
          zone: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
  messages: {
    select: {
      id: true,
      message: true,
      createdAt: true,
      sender: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.SupportTicketSelect;

export type SupportTicketDetailResponse = Prisma.SupportTicketGetPayload<{
  select: typeof supportTicketDetailSelect;
}>;

const supportTicketStatusSelect = {
  id: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.SupportTicketSelect;

export type SupportTicketStatusResponse = Prisma.SupportTicketGetPayload<{
  select: typeof supportTicketStatusSelect;
}>;

/**
 * What an approve or reject answers with. Approving no longer returns a booking
 * because it no longer creates one (SCRUM-182): `grantId` is the permission the
 * vendor now holds, and it is null on a rejection.
 */
export interface QuotaExceptionDecisionResponse {
  ticketId: string;
  status: TicketStatus;
  grantId: string | null;
  decidedAt: Date;
}

const NEXT_TICKET_STATUS: Partial<Record<TicketStatus, TicketStatus>> = {
  [TicketStatus.OPEN]: TicketStatus.PROCESSING,
  [TicketStatus.PROCESSING]: TicketStatus.CLOSED,
};

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
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
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
          orderBy: { createdAt: 'asc' },
        });
        if (bookings.length === 0) {
          throw new NotFoundException('ไม่พบการจองของคุณในงานที่เลือก');
        }

        const context = bookings[0];

        const requestedBooth = await transaction.booth.findFirst({
          where: {
            id: boothId,
            zoneId,
            status: BoothStatus.AVAILABLE,
            zone: {
              venue: {
                events: {
                  some: {
                    id: eventId,
                    organizationId: context.event.organizationId,
                  },
                },
              },
            },
          },
          select: {
            id: true,
            code: true,
            widthM: true,
            heightM: true,
            zone: { select: { code: true, name: true } },
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

        organizationId = context.event.organizationId;
        // A quota ticket carries no event column of its own, and the event id
        // the vendor typed is validated here and then thrown away. Pinning one
        // of their existing bookings in that event is what lets an approval
        // later name the event it is granting quota for, without widening the
        // frozen schema. `bookings` is already filtered to this event, so this
        // cannot point at a different one.
        bookingId = context.id;
        type = TicketType.OTHER;
        contextualMessage = [
          'ประเภทคำร้อง: ขอโควต้าบูธเพิ่ม',
          `งาน: ${context.event.name}`,
          `โซน: ${requestedBooth.zone.name ?? requestedBooth.zone.code}`,
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

    // The fix for "the request never reaches the admin": a quota request used to
    // land in the database and notify nobody, so the only way an admin saw one
    // was by going looking. `createForOrganizationAdmins` already owns the
    // fan-out, its permission filter and its fallback to the OWNER when nobody
    // holds `canManageZones`, so this is a call and not new machinery.
    if (
      requestType === SupportTicketRequestType.QUOTA_INCREASE &&
      ticket.organizationId
    ) {
      await this.notifications.createForOrganizationAdmins(
        ticket.organizationId,
        'zones',
        {
          type: NotificationType.SUPPORT_TICKET,
          title: 'มีคำร้องขอเพิ่มโควตาบูธใหม่',
          body: subject,
          relatedEntityType: 'SUPPORT_TICKET',
          relatedEntityId: ticket.id,
        },
      );
    }

    return this.toResponse(ticket);
  }

  /**
   * Opens an organization-scoped request from an ORG_ADMIN to SUPER_ADMIN.
   * `organizationId` is supplied only by `@CurrentOrgId()` after
   * `@OrgScoped('organizationId')` verified the caller's membership.
   */
  async createForOrganizationAdmin(
    createSupportTicketDto: CreateSupportTicketDto,
    adminUserId: string,
    organizationId: string,
  ): Promise<SupportTicketResponse> {
    if (
      createSupportTicketDto.requestType !==
      SupportTicketRequestType.ISSUE_REPORT
    ) {
      throw new BadRequestException(
        'ผู้ดูแลองค์กรส่งได้เฉพาะคำร้องขอความช่วยเหลือทั่วไป',
      );
    }

    const ticket = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.supportTicket.create({
        data: {
          userId: adminUserId,
          organizationId,
          bookingId: null,
          type: TicketType.ISSUE_REPORT,
          subject: createSupportTicketDto.subject,
          status: TicketStatus.OPEN,
        },
        select: supportTicketSelect,
      });

      await transaction.ticketMessage.create({
        data: {
          ticketId: created.id,
          senderUserId: adminUserId,
          message: [
            'ประเภทคำร้อง: คำร้องจากผู้ดูแลองค์กรถึง Super Admin',
            '',
            createSupportTicketDto.message,
          ].join('\n'),
        },
      });

      return created;
    });

    await this.notifications.createForRole(UserRole.SUPER_ADMIN, {
      type: NotificationType.SUPPORT_TICKET,
      title: 'มีคำร้องจากผู้ดูแลองค์กรใหม่',
      body: createSupportTicketDto.subject,
      relatedEntityType: 'SUPPORT_TICKET',
      relatedEntityId: ticket.id,
    });

    return this.toResponse(ticket);
  }

  async findAllAcrossOrganizations(): Promise<SupportTicketOverviewResponse[]> {
    return this.prisma.supportTicket.findMany({
      select: supportTicketOverviewSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForSuperAdmin(
    ticketId: string,
  ): Promise<SupportTicketDetailResponse> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: supportTicketDetailSelect,
    });

    if (!ticket) {
      throw new NotFoundException('ไม่พบคำร้อง');
    }

    return ticket;
  }

  async updateStatus(
    ticketId: string,
    targetStatus: TicketStatus,
  ): Promise<SupportTicketStatusResponse> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: supportTicketStatusSelect,
    });

    if (!ticket) {
      throw new NotFoundException('ไม่พบคำร้อง');
    }
    if (ticket.status === targetStatus) {
      return ticket;
    }
    if (NEXT_TICKET_STATUS[ticket.status] !== targetStatus) {
      throw new BadRequestException(
        'เปลี่ยนสถานะคำร้องได้ตามลำดับ เปิดอยู่ → กำลังดำเนินการ → ปิดแล้ว เท่านั้น',
      );
    }

    const changed = await this.prisma.supportTicket.updateMany({
      where: { id: ticketId, status: ticket.status },
      data: { status: targetStatus },
    });
    if (changed.count === 0) {
      throw new ConflictException(
        'สถานะคำร้องถูกเปลี่ยนโดยผู้ดูแลคนอื่น กรุณาโหลดข้อมูลใหม่',
      );
    }

    const updated = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: supportTicketStatusSelect,
    });
    if (!updated) {
      throw new NotFoundException('ไม่พบคำร้อง');
    }

    return updated;
  }

  /** The organization's own request inbox, scoped by the guard-derived org. */
  async findAllForOrganizationAdmin(
    organizationId: string,
  ): Promise<SupportTicketOverviewResponse[]> {
    return this.prisma.supportTicket.findMany({
      where: { organizationId },
      select: supportTicketOverviewSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * One request in full. The `organizationId` filter is what makes another
   * organization's ticket answer 404 rather than 403 — a 403 would confirm the
   * id names a real ticket to a caller with no right to know that.
   */
  async findOneForOrganizationAdmin(
    ticketId: string,
    organizationId: string,
  ): Promise<SupportTicketDetailResponse> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId },
      select: supportTicketDetailSelect,
    });

    if (!ticket) {
      throw new NotFoundException('ไม่พบคำร้อง');
    }

    return ticket;
  }

  /**
   * Approves a quota request by granting permission — **not** by creating a
   * booking. The vendor returns to the normal booking flow and picks a booth
   * themselves, because pre-selecting one here would let an approval beat
   * another vendor who is booking that same booth in real time.
   *
   * The grant has no expiry of its own. It dies with its event: every create
   * path already refuses an event that is not PUBLISHED/ONGOING or whose end
   * date has passed, so a grant cannot outlive the thing it applies to.
   *
   * `orgId` comes from `@CurrentOrgId()`, which OrgScopeGuard already derived
   * from this exact ticket's own `organizationId` — so the filter below cannot
   * exclude a row the guard allowed, and a foreign ticket never gets this far.
   */
  async approveQuotaException(
    ticketId: string,
    approveQuotaExceptionDto: ApproveQuotaExceptionDto,
    orgId: string,
    actingAdminUserId: string,
  ): Promise<QuotaExceptionDecisionResponse> {
    const ticket = await this.loadActionableQuotaTicket(ticketId, orgId);
    const eventId = ticket.booking?.eventId;
    if (!eventId) {
      throw new ConflictException(
        'คำร้องนี้ไม่มีข้อมูลงานที่เกี่ยวข้อง ไม่สามารถอนุมัติได้',
      );
    }

    // Claim and grant in one transaction. The old flow could not do this — it
    // called into a second serializable transaction and had to hand-roll a
    // status rollback — but a grant is a single local insert, so the ticket and
    // the permission it produced now commit or fail together.
    const grantId = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.supportTicket.updateMany({
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

      const grant = await transaction.boothQuotaGrant.create({
        data: {
          vendorUserId: ticket.userId,
          eventId,
          organizationId: orgId,
          sourceTicketId: ticketId,
          grantedByUserId: actingAdminUserId,
        },
        select: { id: true },
      });

      return grant.id;
    });

    await this.auditLogs.record({
      actorUserId: actingAdminUserId,
      action: 'QUOTA_EXCEPTION_APPROVED',
      targetType: 'SUPPORT_TICKET',
      targetId: ticketId,
      metadata: {
        previousStatus: ticket.status,
        newStatus: TicketStatus.CLOSED,
        grantId,
        vendorUserId: ticket.userId,
        eventId,
        organizationId: orgId,
        reason: approveQuotaExceptionDto.reason ?? null,
      },
    });

    await this.notifications.createForUser(ticket.userId, {
      type: NotificationType.SUPPORT_TICKET,
      title: 'คำร้องขอเพิ่มโควตาได้รับการอนุมัติแล้ว',
      body: 'คุณสามารถกลับไปเลือกบูธที่ต้องการได้ด้วยตนเอง โดยใช้สิทธิ์ได้จนกว่างานจะปิดรับจอง',
      relatedEntityType: 'SUPPORT_TICKET',
      relatedEntityId: ticketId,
    });

    return {
      ticketId,
      status: TicketStatus.CLOSED,
      grantId,
      decidedAt: new Date(),
    };
  }

  /**
   * Closes a quota request without granting anything. Same atomic claim as the
   * approve path, so two admins cannot both decide one ticket; the reason is
   * recorded for the audit trail and shown to the vendor verbatim.
   */
  async rejectQuotaException(
    ticketId: string,
    rejectQuotaExceptionDto: RejectQuotaExceptionDto,
    orgId: string,
    actingAdminUserId: string,
  ): Promise<QuotaExceptionDecisionResponse> {
    const ticket = await this.loadActionableQuotaTicket(ticketId, orgId);

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

    await this.auditLogs.record({
      actorUserId: actingAdminUserId,
      action: 'QUOTA_EXCEPTION_REJECTED',
      targetType: 'SUPPORT_TICKET',
      targetId: ticketId,
      metadata: {
        previousStatus: ticket.status,
        newStatus: TicketStatus.CLOSED,
        vendorUserId: ticket.userId,
        organizationId: orgId,
        reason: rejectQuotaExceptionDto.reason,
      },
    });

    await this.notifications.createForUser(ticket.userId, {
      type: NotificationType.SUPPORT_TICKET,
      title: 'คำร้องขอเพิ่มโควตาไม่ได้รับการอนุมัติ',
      body: rejectQuotaExceptionDto.reason,
      relatedEntityType: 'SUPPORT_TICKET',
      relatedEntityId: ticketId,
    });

    return {
      ticketId,
      status: TicketStatus.CLOSED,
      grantId: null,
      decidedAt: new Date(),
    };
  }

  /**
   * Shared pre-check for both decisions. The TicketType.OTHER gate matters:
   * these two routes must not be usable to mint a booth grant out of an issue
   * report, which is a different ticket type that also carries a bookingId.
   */
  private async loadActionableQuotaTicket(
    ticketId: string,
    orgId: string,
  ): Promise<{
    id: string;
    userId: string;
    status: TicketStatus;
    booking: { eventId: string } | null;
  }> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId: orgId, type: TicketType.OTHER },
      select: {
        id: true,
        userId: true,
        status: true,
        booking: { select: { eventId: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('ไม่พบคำร้อง');
    }
    if (!ACTIONABLE_TICKET_STATUSES.includes(ticket.status)) {
      throw new ConflictException('คำร้องนี้ถูกปิดไปแล้ว');
    }

    return ticket;
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
