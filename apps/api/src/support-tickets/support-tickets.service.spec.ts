import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationType,
  Prisma,
  TicketStatus,
  TicketType,
} from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupportTicketsService } from './support-tickets.service';
import { ApproveQuotaExceptionDto } from './dto/approve-quota-exception.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

const TICKET_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const BOOTH_ID = '33333333-3333-4333-8333-333333333333';
const SHOP_ID = '44444444-4444-4444-8444-444444444444';
const VENDOR_ID = '55555555-5555-4555-8555-555555555555';
const ORGANIZATION_ID = '66666666-6666-4666-8666-666666666666';
const BOOKING_ID = '77777777-7777-4777-8777-777777777777';
const NOW = new Date('2026-08-02T00:00:00.000Z');

const CREATE_DTO: CreateSupportTicketDto = {
  eventId: EVENT_ID,
  subject: 'ขอเพิ่มโควตาการจอง',
  message: 'ต้องการจองบูธเพิ่มอีก 1 บูธในงานนี้',
};
const APPROVE_DTO: ApproveQuotaExceptionDto = {
  eventId: EVENT_ID,
  boothId: BOOTH_ID,
};

const CREATED_TICKET = {
  id: TICKET_ID,
  userId: VENDOR_ID,
  organizationId: ORGANIZATION_ID,
  bookingId: null,
  type: TicketType.OTHER,
  subject: CREATE_DTO.subject,
  status: TicketStatus.OPEN,
  createdAt: NOW,
  updatedAt: NOW,
};

const CREATED_BOOKING = {
  id: BOOKING_ID,
  bookingCode: 'BK-0123456789AB',
  boothPrice: '1500',
};

const eventFindUnique = jest.fn();
const supportTicketCreate = jest.fn();
const supportTicketFindFirst = jest.fn();
const supportTicketUpdateMany = jest.fn();
const ticketMessageCreate = jest.fn();
const shopFindFirst = jest.fn();
const prismaTransaction = jest.fn();
const createForAdmin = jest.fn();
const createForUser = jest.fn();

const mockPrismaService = {
  event: { findUnique: eventFindUnique },
  supportTicket: {
    create: supportTicketCreate,
    findFirst: supportTicketFindFirst,
    updateMany: supportTicketUpdateMany,
  },
  ticketMessage: { create: ticketMessageCreate },
  shop: { findFirst: shopFindFirst },
  $transaction: prismaTransaction,
};
const mockBookingsService = { createForAdmin };
const mockNotificationsService = { createForUser };

describe('SupportTicketsService', () => {
  let service: SupportTicketsService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();

    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(mockPrismaService as unknown as Prisma.TransactionClient),
    );

    eventFindUnique.mockResolvedValue({ organizationId: ORGANIZATION_ID });
    supportTicketCreate.mockResolvedValue(CREATED_TICKET);
    ticketMessageCreate.mockResolvedValue({ id: 'ticket-message-1' });
    supportTicketFindFirst.mockResolvedValue({
      id: TICKET_ID,
      userId: VENDOR_ID,
      status: TicketStatus.OPEN,
    });
    supportTicketUpdateMany.mockResolvedValue({ count: 1 });
    shopFindFirst.mockResolvedValue({ id: SHOP_ID });
    createForAdmin.mockResolvedValue(CREATED_BOOKING);
    createForUser.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BookingsService, useValue: mockBookingsService },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<SupportTicketsService>(SupportTicketsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('opens a ticket and its first message in one transaction', async () => {
      const result = await service.create(CREATE_DTO, VENDOR_ID);

      expect(result).toEqual(CREATED_TICKET);
      expect(eventFindUnique).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        select: { organizationId: true },
      });
      expect(supportTicketCreate).toHaveBeenCalledWith({
        data: {
          userId: VENDOR_ID,
          // Taken from the event, never from anything the vendor sent (§14.2).
          organizationId: ORGANIZATION_ID,
          bookingId: null,
          type: TicketType.OTHER,
          subject: CREATE_DTO.subject,
          status: TicketStatus.OPEN,
        },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          bookingId: true,
          type: true,
          subject: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(ticketMessageCreate).toHaveBeenCalledWith({
        data: {
          ticketId: TICKET_ID,
          senderUserId: VENDOR_ID,
          message: CREATE_DTO.message,
        },
      });
      // A ticket with no message would be a request nobody can read, so the two
      // writes go together or not at all.
      expect(prismaTransaction).toHaveBeenCalledTimes(1);
    });

    it('records the authenticated vendor as the owner, not a body field', async () => {
      await service.create(CREATE_DTO, VENDOR_ID);

      const [args] = supportTicketCreate.mock.calls[0] as [
        { data: { userId: string } },
      ];
      expect(args.data.userId).toBe(VENDOR_ID);
    });

    it('returns 404 for an unknown event without writing anything', async () => {
      eventFindUnique.mockResolvedValue(null);

      await expect(
        service.create(CREATE_DTO, VENDOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
        'ไม่พบอีเวนต์',
      );
      expect(supportTicketCreate).not.toHaveBeenCalled();
      expect(ticketMessageCreate).not.toHaveBeenCalled();
    });
  });

  describe('approveQuotaException', () => {
    it('creates the booking for the ticket owner and closes the ticket', async () => {
      const result = await service.approveQuotaException(
        TICKET_ID,
        APPROVE_DTO,
        ORGANIZATION_ID,
      );

      expect(result).toEqual(CREATED_BOOKING);
      // The org filter repeats what OrgScopeGuard already resolved — it cannot
      // exclude a row the guard allowed, and it forces every caller to have an
      // orgId to pass (§14.2).
      expect(supportTicketFindFirst).toHaveBeenCalledWith({
        where: { id: TICKET_ID, organizationId: ORGANIZATION_ID },
        select: { id: true, userId: true, status: true },
      });
      // The shop belongs to the ticket owner, not to the approving admin.
      expect(shopFindFirst).toHaveBeenCalledWith({
        where: { ownerUserId: VENDOR_ID },
        select: { id: true },
      });
      expect(createForAdmin).toHaveBeenCalledWith(
        { eventId: EVENT_ID, boothId: BOOTH_ID, shopId: SHOP_ID },
        VENDOR_ID,
      );
      expect(createForUser).toHaveBeenCalledWith(VENDOR_ID, {
        type: NotificationType.SUPPORT_TICKET,
        title: 'คำร้องขอยกเว้นโควตาได้รับการอนุมัติแล้ว',
        body: 'ระบบสร้างการจองให้คุณเรียบร้อยแล้ว',
        relatedEntityType: 'SUPPORT_TICKET',
        relatedEntityId: TICKET_ID,
      });
      expect(supportTicketUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
        createForUser.mock.invocationCallOrder[0],
      );
    });

    // The status sits in the `where`, not only in the guard above it: two
    // admins approving at once must not both close the same ticket.
    it('closes the ticket only while it is still actionable', async () => {
      await service.approveQuotaException(
        TICKET_ID,
        APPROVE_DTO,
        ORGANIZATION_ID,
      );

      expect(supportTicketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: TICKET_ID,
          status: { in: [TicketStatus.OPEN, TicketStatus.PROCESSING] },
        },
        data: {
          status: TicketStatus.CLOSED,
          bookingId: BOOKING_ID,
        },
      });
    });

    it('approves a ticket that is already being processed', async () => {
      supportTicketFindFirst.mockResolvedValue({
        id: TICKET_ID,
        userId: VENDOR_ID,
        status: TicketStatus.PROCESSING,
      });

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).resolves.toEqual(CREATED_BOOKING);
    });

    it('rejects a ticket that is already closed', async () => {
      supportTicketFindFirst.mockResolvedValue({
        id: TICKET_ID,
        userId: VENDOR_ID,
        status: TicketStatus.CLOSED,
      });

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(createForAdmin).not.toHaveBeenCalled();
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
      expect(createForUser).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing or out-of-organization ticket', async () => {
      supportTicketFindFirst.mockResolvedValue(null);

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(createForAdmin).not.toHaveBeenCalled();
    });

    it('returns 404 when the ticket owner still has no shop', async () => {
      shopFindFirst.mockResolvedValue(null);

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).rejects.toThrow('ไม่พบร้านค้าของผู้ใช้');
      expect(createForAdmin).not.toHaveBeenCalled();
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
      expect(createForUser).not.toHaveBeenCalled();
    });

    // Booth conflicts, an unbookable event and a missing booth are all decided
    // by BookingsService. Nothing here rewrites them into a different answer.
    it('lets a booking failure propagate and leaves the ticket open', async () => {
      createForAdmin.mockRejectedValue(
        new ConflictException('บูธนี้ถูกจองไปแล้ว'),
      );

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).rejects.toThrow('บูธนี้ถูกจองไปแล้ว');
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
    });

    // Losing the close race does not un-create a committed booking: the admin
    // is told which booking exists, and the divergence is logged for a human.
    it('returns the booking and warns when another approval closed first', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      supportTicketUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).resolves.toEqual(CREATED_BOOKING);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(BOOKING_ID) as string,
      );

      warn.mockRestore();
    });
  });
});
