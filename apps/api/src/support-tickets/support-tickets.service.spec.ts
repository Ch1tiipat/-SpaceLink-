import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  BoothStatus,
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
import {
  CreateSupportTicketDto,
  SupportTicketRequestType,
} from './dto/create-support-ticket.dto';

const TICKET_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const BOOTH_ID = '33333333-3333-4333-8333-333333333333';
const ZONE_ID = '88888888-8888-4888-8888-888888888888';
const SHOP_ID = '44444444-4444-4444-8444-444444444444';
const VENDOR_ID = '55555555-5555-4555-8555-555555555555';
const ORGANIZATION_ID = '66666666-6666-4666-8666-666666666666';
const BOOKING_ID = '77777777-7777-4777-8777-777777777777';
const NOW = new Date('2026-08-02T00:00:00.000Z');

const CREATE_DTO: CreateSupportTicketDto = {
  requestType: SupportTicketRequestType.QUOTA_INCREASE,
  eventId: EVENT_ID,
  zoneId: ZONE_ID,
  boothId: BOOTH_ID,
  subject: 'ขอเพิ่มโควตาการจอง',
  message: 'ต้องการจองบูธเพิ่มอีก 1 บูธในงานนี้',
};
const ISSUE_DTO: CreateSupportTicketDto = {
  requestType: SupportTicketRequestType.ISSUE_REPORT,
  bookingId: BOOKING_ID,
  subject: 'พบปัญหาในบูธ',
  message: 'ไฟฟ้าในบูธใช้งานไม่ได้',
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

const bookingFindMany = jest.fn();
const bookingFindFirst = jest.fn();
const boothFindFirst = jest.fn();
const supportTicketCreate = jest.fn();
const supportTicketFindFirst = jest.fn();
const supportTicketUpdateMany = jest.fn();
const supportTicketUpdate = jest.fn();
const supportTicketFindMany = jest.fn();
const ticketMessageCreate = jest.fn();
const shopFindFirst = jest.fn();
const prismaTransaction = jest.fn();
const createForAdmin = jest.fn();
const createForUser = jest.fn();

const mockPrismaService = {
  booking: { findMany: bookingFindMany, findFirst: bookingFindFirst },
  booth: { findFirst: boothFindFirst },
  supportTicket: {
    create: supportTicketCreate,
    findFirst: supportTicketFindFirst,
    updateMany: supportTicketUpdateMany,
    update: supportTicketUpdate,
    findMany: supportTicketFindMany,
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

    bookingFindMany.mockResolvedValue([
      {
        bookingCode: 'BK-ONE',
        event: { name: 'งานทดสอบ', organizationId: ORGANIZATION_ID },
        booth: {
          code: 'A01',
          zone: { code: 'A', name: 'โซนอาหาร' },
        },
      },
    ]);
    bookingFindFirst.mockResolvedValue(null);
    boothFindFirst.mockResolvedValue({
      id: BOOTH_ID,
      code: 'A03',
      widthM: new Prisma.Decimal('3'),
      heightM: new Prisma.Decimal('2.5'),
    });
    supportTicketCreate.mockResolvedValue(CREATED_TICKET);
    ticketMessageCreate.mockResolvedValue({ id: 'ticket-message-1' });
    supportTicketFindFirst.mockResolvedValue({
      id: TICKET_ID,
      userId: VENDOR_ID,
      status: TicketStatus.OPEN,
    });
    supportTicketUpdateMany.mockResolvedValue({ count: 1 });
    supportTicketUpdate.mockResolvedValue({ id: TICKET_ID });
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

  describe('findAllAcrossOrganizations', () => {
    it('lists every ticket across organizations with user and org context', async () => {
      supportTicketFindMany.mockResolvedValue([]);

      await service.findAllAcrossOrganizations();

      expect(supportTicketFindMany).toHaveBeenCalledWith({
        select: {
          id: true,
          type: true,
          subject: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, fullName: true } },
          organization: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('opens a ticket and its first message in one transaction', async () => {
      const result = await service.create(CREATE_DTO, VENDOR_ID);

      expect(result).toEqual(CREATED_TICKET);
      expect(bookingFindMany).toHaveBeenCalledWith({
        where: {
          vendorUserId: VENDOR_ID,
          eventId: EVENT_ID,
          status: {
            in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
          },
          booth: { zoneId: ZONE_ID },
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
      expect(boothFindFirst).toHaveBeenCalledWith({
        where: {
          id: BOOTH_ID,
          zoneId: ZONE_ID,
          status: BoothStatus.AVAILABLE,
        },
        select: {
          id: true,
          code: true,
          widthM: true,
          heightM: true,
        },
      });
      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: {
          eventId: EVENT_ID,
          boothId: BOOTH_ID,
          status: {
            in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
          },
        },
        select: { id: true },
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
          message: [
            'ประเภทคำร้อง: ขอโควต้าบูธเพิ่ม',
            'งาน: งานทดสอบ',
            'โซน: โซนอาหาร',
            'บูธที่ต้องการเพิ่ม: A03 (3 × 2.5 เมตร)',
            'บูธปัจจุบัน: A01 (BK-ONE)',
            '',
            CREATE_DTO.message,
          ].join('\n'),
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

    it('returns 404 when the vendor has no active booking in that event and zone', async () => {
      bookingFindMany.mockResolvedValue([]);

      await expect(
        service.create(CREATE_DTO, VENDOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
        'ไม่พบการจองของคุณในงานและโซนที่เลือก',
      );
      expect(supportTicketCreate).not.toHaveBeenCalled();
      expect(ticketMessageCreate).not.toHaveBeenCalled();
    });

    it('returns 404 when the requested booth is outside the selected zone', async () => {
      boothFindFirst.mockResolvedValue(null);

      await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
        'ไม่พบบูธที่เลือกในโซนนี้',
      );
      expect(supportTicketCreate).not.toHaveBeenCalled();
    });

    it('rejects a requested booth that is already actively booked', async () => {
      bookingFindFirst.mockResolvedValue({ id: BOOKING_ID });

      await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
        'บูธที่เลือกไม่ว่างแล้ว กรุณาเลือกบูธอื่น',
      );
      expect(supportTicketCreate).not.toHaveBeenCalled();
    });

    it('links an issue report only to a booking owned by the vendor', async () => {
      const issueTicket = {
        ...CREATED_TICKET,
        bookingId: BOOKING_ID,
        type: TicketType.ISSUE_REPORT,
        subject: ISSUE_DTO.subject,
      };
      supportTicketCreate.mockResolvedValue(issueTicket);
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        bookingCode: 'BK-ONE',
        event: { name: 'งานทดสอบ', organizationId: ORGANIZATION_ID },
        booth: {
          code: 'A01',
          zone: { code: 'A', name: 'โซนอาหาร' },
        },
      });

      await expect(service.create(ISSUE_DTO, VENDOR_ID)).resolves.toEqual(
        issueTicket,
      );

      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: { id: BOOKING_ID, vendorUserId: VENDOR_ID },
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
      const [createArgs] = supportTicketCreate.mock.calls[0] as [
        {
          data: {
            organizationId: string | null;
            bookingId: string | null;
            type: TicketType;
          };
        },
      ];
      expect(createArgs.data).toMatchObject({
        organizationId: ORGANIZATION_ID,
        bookingId: BOOKING_ID,
        type: TicketType.ISSUE_REPORT,
      });
    });

    it('opens a general issue without assigning it to an organization', async () => {
      const generalIssue = { ...ISSUE_DTO, bookingId: undefined };
      const issueTicket = {
        ...CREATED_TICKET,
        organizationId: null,
        type: TicketType.ISSUE_REPORT,
        subject: ISSUE_DTO.subject,
      };
      supportTicketCreate.mockResolvedValue(issueTicket);

      await service.create(generalIssue, VENDOR_ID);

      expect(bookingFindFirst).not.toHaveBeenCalled();
      const [createArgs] = supportTicketCreate.mock.calls[0] as [
        {
          data: {
            organizationId: string | null;
            bookingId: string | null;
            type: TicketType;
          };
        },
      ];
      expect(createArgs.data).toMatchObject({
        organizationId: null,
        bookingId: null,
        type: TicketType.ISSUE_REPORT,
      });
    });

    it('returns 404 instead of linking an issue to another vendor booking', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(service.create(ISSUE_DTO, VENDOR_ID)).rejects.toThrow(
        'ไม่พบการจองที่เลือก',
      );
      expect(supportTicketCreate).not.toHaveBeenCalled();
    });
  });

  describe('approveQuotaException', () => {
    it('claims the ticket, creates the booking, and links it before notifying', async () => {
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
      expect(supportTicketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: TICKET_ID,
          organizationId: ORGANIZATION_ID,
          status: { in: [TicketStatus.OPEN, TicketStatus.PROCESSING] },
        },
        data: { status: TicketStatus.CLOSED },
      });
      // The shop belongs to the ticket owner, not to the approving admin.
      expect(shopFindFirst).toHaveBeenCalledWith({
        where: { ownerUserId: VENDOR_ID },
        select: { id: true },
      });
      expect(createForAdmin).toHaveBeenCalledWith(
        { eventId: EVENT_ID, boothId: BOOTH_ID, shopId: SHOP_ID },
        VENDOR_ID,
        ORGANIZATION_ID,
      );
      expect(supportTicketUpdate).toHaveBeenCalledWith({
        where: { id: TICKET_ID, organizationId: ORGANIZATION_ID },
        data: { bookingId: BOOKING_ID },
      });
      expect(createForUser).toHaveBeenCalledWith(VENDOR_ID, {
        type: NotificationType.SUPPORT_TICKET,
        title: 'คำร้องขอยกเว้นโควตาได้รับการอนุมัติแล้ว',
        body: 'ระบบสร้างการจองให้คุณเรียบร้อยแล้ว',
        relatedEntityType: 'SUPPORT_TICKET',
        relatedEntityId: TICKET_ID,
      });
      expect(supportTicketUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
        shopFindFirst.mock.invocationCallOrder[0],
      );
      expect(shopFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
        createForAdmin.mock.invocationCallOrder[0],
      );
      expect(createForAdmin.mock.invocationCallOrder[0]).toBeLessThan(
        supportTicketUpdate.mock.invocationCallOrder[0],
      );
      expect(supportTicketUpdate.mock.invocationCallOrder[0]).toBeLessThan(
        createForUser.mock.invocationCallOrder[0],
      );
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
      expect(supportTicketUpdate).not.toHaveBeenCalled();
      expect(createForUser).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing or out-of-organization ticket', async () => {
      supportTicketFindFirst.mockResolvedValue(null);

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
      expect(supportTicketUpdate).not.toHaveBeenCalled();
      expect(createForAdmin).not.toHaveBeenCalled();
    });

    it('restores the open ticket when its owner still has no shop', async () => {
      shopFindFirst.mockResolvedValue(null);

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).rejects.toThrow('ไม่พบร้านค้าของผู้ใช้');
      expect(createForAdmin).not.toHaveBeenCalled();
      expect(supportTicketUpdate).toHaveBeenCalledWith({
        where: { id: TICKET_ID, organizationId: ORGANIZATION_ID },
        data: { status: TicketStatus.OPEN },
      });
      expect(createForUser).not.toHaveBeenCalled();
    });

    // Booth conflicts, an unbookable event and a missing booth are all decided
    // by BookingsService. Nothing here rewrites them into a different answer.
    it('restores the original status and rethrows the booking error unchanged', async () => {
      const bookingError = new ConflictException('บูธนี้ถูกจองไปแล้ว');
      supportTicketFindFirst.mockResolvedValue({
        id: TICKET_ID,
        userId: VENDOR_ID,
        status: TicketStatus.PROCESSING,
      });
      createForAdmin.mockRejectedValue(bookingError);

      await expect(
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ).rejects.toBe(bookingError);
      expect(supportTicketUpdate).toHaveBeenCalledWith({
        where: { id: TICKET_ID, organizationId: ORGANIZATION_ID },
        data: { status: TicketStatus.PROCESSING },
      });
      expect(createForUser).not.toHaveBeenCalled();
    });

    it('allows only one concurrent approval to create a booking', async () => {
      supportTicketUpdateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const [winner, loser] = await Promise.allSettled([
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
        service.approveQuotaException(TICKET_ID, APPROVE_DTO, ORGANIZATION_ID),
      ]);

      expect(winner.status).toBe('fulfilled');
      if (winner.status === 'fulfilled') {
        expect(winner.value).toEqual(CREATED_BOOKING);
      }
      expect(loser.status).toBe('rejected');
      if (loser.status === 'rejected') {
        expect(loser.reason).toBeInstanceOf(ConflictException);
        expect(loser.reason).toMatchObject({
          message: 'คำร้องนี้ถูกปิดไปแล้ว',
        });
      }
      expect(shopFindFirst).toHaveBeenCalledTimes(1);
      expect(createForAdmin).toHaveBeenCalledTimes(1);
      expect(supportTicketUpdate).toHaveBeenCalledTimes(1);
      expect(createForUser).toHaveBeenCalledTimes(1);
      expect(supportTicketUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { bookingId: BOOKING_ID } }),
      );
    });
  });
});
