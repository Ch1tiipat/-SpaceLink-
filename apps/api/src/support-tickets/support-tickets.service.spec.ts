import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
import { SupportTicketsService } from './support-tickets.service';
import { ApproveQuotaExceptionDto } from './dto/approve-quota-exception.dto';
import {
  CreateSupportTicketDto,
  SupportTicketRequestType,
} from './dto/create-support-ticket.dto';
import { RejectQuotaExceptionDto } from './dto/reject-quota-exception.dto';

const TICKET_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const BOOTH_ID = '33333333-3333-4333-8333-333333333333';
const ZONE_ID = '88888888-8888-4888-8888-888888888888';
const SHOP_ID = '44444444-4444-4444-8444-444444444444';
const VENDOR_ID = '55555555-5555-4555-8555-555555555555';
const ADMIN_ID = '99999999-9999-4999-8999-999999999999';
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
const ADMIN_ISSUE_DTO: CreateSupportTicketDto = {
  requestType: SupportTicketRequestType.ISSUE_REPORT,
  subject: 'ขอความช่วยเหลือจาก Super Admin',
  message: 'กรุณาตรวจสอบการตั้งค่าขององค์กร',
};
const GRANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const APPROVE_DTO: ApproveQuotaExceptionDto = {
  reason: 'อนุมัติตามที่ร้องขอ',
};
const REJECT_DTO: RejectQuotaExceptionDto = {
  reason: 'โควตาของงานนี้เต็มแล้ว',
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

const bookingFindMany = jest.fn();
const bookingFindFirst = jest.fn();
const boothFindFirst = jest.fn();
const supportTicketCreate = jest.fn();
const supportTicketFindFirst = jest.fn();
const supportTicketFindUnique = jest.fn();
const supportTicketUpdateMany = jest.fn();
const supportTicketUpdate = jest.fn();
const supportTicketFindMany = jest.fn();
const ticketMessageCreate = jest.fn();
const shopFindFirst = jest.fn();
const prismaTransaction = jest.fn();
const quotaGrantCreate = jest.fn();
const createForUser = jest.fn();
const createForRole = jest.fn();
const createForOrganizationAdmins = jest.fn();
const recordAuditLog = jest.fn();

const mockPrismaService = {
  booking: { findMany: bookingFindMany, findFirst: bookingFindFirst },
  booth: { findFirst: boothFindFirst },
  supportTicket: {
    create: supportTicketCreate,
    findFirst: supportTicketFindFirst,
    findUnique: supportTicketFindUnique,
    updateMany: supportTicketUpdateMany,
    update: supportTicketUpdate,
    findMany: supportTicketFindMany,
  },
  ticketMessage: { create: ticketMessageCreate },
  shop: { findFirst: shopFindFirst },
  boothQuotaGrant: { create: quotaGrantCreate },
  $transaction: prismaTransaction,
};
const mockNotificationsService = {
  createForUser,
  createForRole,
  createForOrganizationAdmins,
};
const mockAuditLogsService = { record: recordAuditLog };

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
        id: BOOKING_ID,
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
      booking: { eventId: EVENT_ID },
    });
    supportTicketFindUnique.mockResolvedValue({
      id: TICKET_ID,
      status: TicketStatus.OPEN,
      updatedAt: NOW,
    });
    supportTicketUpdateMany.mockResolvedValue({ count: 1 });
    supportTicketUpdate.mockResolvedValue({ id: TICKET_ID });
    shopFindFirst.mockResolvedValue({ id: SHOP_ID });
    quotaGrantCreate.mockResolvedValue({ id: GRANT_ID });
    createForUser.mockResolvedValue(null);
    createForRole.mockResolvedValue(1);
    createForOrganizationAdmins.mockResolvedValue(1);
    recordAuditLog.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
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

  describe('findOneForSuperAdmin', () => {
    it('loads the full request conversation and related booking context', async () => {
      const detail = {
        ...CREATED_TICKET,
        user: {
          id: VENDOR_ID,
          email: 'vendor@example.com',
          fullName: 'Vendor One',
        },
        organization: { id: ORGANIZATION_ID, name: 'Organization One' },
        booking: null,
        messages: [],
      };
      supportTicketFindUnique.mockResolvedValue(detail);

      await expect(service.findOneForSuperAdmin(TICKET_ID)).resolves.toEqual(
        detail,
      );

      expect(supportTicketFindUnique).toHaveBeenCalledWith({
        where: { id: TICKET_ID },
        select: expect.objectContaining({
          user: { select: { id: true, email: true, fullName: true } },
          organization: { select: { id: true, name: true } },
          booking: expect.any(Object) as object,
          messages: expect.objectContaining({
            orderBy: { createdAt: 'asc' },
          }) as object,
        }) as object,
      });
    });

    it('returns 404 when the ticket no longer exists', async () => {
      supportTicketFindUnique.mockResolvedValue(null);

      await expect(
        service.findOneForSuperAdmin(TICKET_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('moves an open ticket to processing and returns the updated status', async () => {
      const updated = {
        id: TICKET_ID,
        status: TicketStatus.PROCESSING,
        updatedAt: new Date('2026-08-02T01:00:00.000Z'),
      };
      supportTicketFindUnique
        .mockResolvedValueOnce({
          id: TICKET_ID,
          status: TicketStatus.OPEN,
          updatedAt: NOW,
        })
        .mockResolvedValueOnce(updated);

      await expect(
        service.updateStatus(TICKET_ID, TicketStatus.PROCESSING),
      ).resolves.toEqual(updated);

      expect(supportTicketUpdateMany).toHaveBeenCalledWith({
        where: { id: TICKET_ID, status: TicketStatus.OPEN },
        data: { status: TicketStatus.PROCESSING },
      });
    });

    it('moves a processing ticket to closed', async () => {
      supportTicketFindUnique
        .mockResolvedValueOnce({
          id: TICKET_ID,
          status: TicketStatus.PROCESSING,
          updatedAt: NOW,
        })
        .mockResolvedValueOnce({
          id: TICKET_ID,
          status: TicketStatus.CLOSED,
          updatedAt: NOW,
        });

      await expect(
        service.updateStatus(TICKET_ID, TicketStatus.CLOSED),
      ).resolves.toMatchObject({ status: TicketStatus.CLOSED });
    });

    it('keeps an idempotent status request unchanged', async () => {
      const current = {
        id: TICKET_ID,
        status: TicketStatus.OPEN,
        updatedAt: NOW,
      };
      supportTicketFindUnique.mockResolvedValue(current);

      await expect(
        service.updateStatus(TICKET_ID, TicketStatus.OPEN),
      ).resolves.toEqual(current);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects skipping or reversing the workflow', async () => {
      supportTicketFindUnique.mockResolvedValue({
        id: TICKET_ID,
        status: TicketStatus.OPEN,
        updatedAt: NOW,
      });

      await expect(
        service.updateStatus(TICKET_ID, TicketStatus.CLOSED),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing ticket', async () => {
      supportTicketFindUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(TICKET_ID, TicketStatus.PROCESSING),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
    });

    it('detects a concurrent status change', async () => {
      supportTicketUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(TICKET_ID, TicketStatus.PROCESSING),
      ).rejects.toBeInstanceOf(ConflictException);
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
          // One of the vendor's own bookings in the requested event. A quota
          // ticket has no event column, so this is what lets an approval name
          // the event it grants for (SCRUM-182).
          bookingId: BOOKING_ID,
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
      expect(createForRole).not.toHaveBeenCalled();
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

  describe('createForOrganizationAdmin', () => {
    it('creates a ticket for the guard-resolved organization', async () => {
      const adminTicket = {
        ...CREATED_TICKET,
        userId: ADMIN_ID,
        organizationId: ORGANIZATION_ID,
        type: TicketType.ISSUE_REPORT,
        subject: ADMIN_ISSUE_DTO.subject,
      };
      supportTicketCreate.mockResolvedValue(adminTicket);

      await expect(
        service.createForOrganizationAdmin(
          ADMIN_ISSUE_DTO,
          ADMIN_ID,
          ORGANIZATION_ID,
        ),
      ).resolves.toEqual(adminTicket);

      expect(supportTicketCreate).toHaveBeenCalledWith({
        data: {
          userId: ADMIN_ID,
          organizationId: ORGANIZATION_ID,
          bookingId: null,
          type: TicketType.ISSUE_REPORT,
          subject: ADMIN_ISSUE_DTO.subject,
          status: TicketStatus.OPEN,
        },
        select: expect.any(Object) as object,
      });
      expect(ticketMessageCreate).toHaveBeenCalledWith({
        data: {
          ticketId: TICKET_ID,
          senderUserId: ADMIN_ID,
          message: [
            'ประเภทคำร้อง: คำร้องจากผู้ดูแลองค์กรถึง Super Admin',
            '',
            ADMIN_ISSUE_DTO.message,
          ].join('\n'),
        },
      });
      expect(prismaTransaction).toHaveBeenCalledTimes(1);
      expect(createForRole).toHaveBeenCalledWith(UserRole.SUPER_ADMIN, {
        type: NotificationType.SUPPORT_TICKET,
        title: 'มีคำร้องจากผู้ดูแลองค์กรใหม่',
        body: ADMIN_ISSUE_DTO.subject,
        relatedEntityType: 'SUPPORT_TICKET',
        relatedEntityId: TICKET_ID,
      });
      expect(supportTicketCreate.mock.invocationCallOrder[0]).toBeLessThan(
        createForRole.mock.invocationCallOrder[0],
      );
    });

    it('rejects the vendor-only quota request type', async () => {
      await expect(
        service.createForOrganizationAdmin(
          CREATE_DTO,
          ADMIN_ID,
          ORGANIZATION_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(supportTicketCreate).not.toHaveBeenCalled();
      expect(ticketMessageCreate).not.toHaveBeenCalled();
      expect(createForRole).not.toHaveBeenCalled();
    });
  });

  describe('findAllForOrganizationAdmin', () => {
    it('filters the inbox to the guard-resolved organization', async () => {
      supportTicketFindMany.mockResolvedValue([]);

      await service.findAllForOrganizationAdmin(ORGANIZATION_ID);

      // §14.2: an org-scoped query without an explicit organization filter is a
      // cross-tenant leak, not an error anyone would ever see.
      expect(supportTicketFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ORGANIZATION_ID },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findOneForOrganizationAdmin', () => {
    it('scopes the detail read to the organization', async () => {
      supportTicketFindFirst.mockResolvedValue({ id: TICKET_ID });

      await service.findOneForOrganizationAdmin(TICKET_ID, ORGANIZATION_ID);

      expect(supportTicketFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TICKET_ID, organizationId: ORGANIZATION_ID },
        }),
      );
    });

    it('answers 404 for a ticket belonging to another organization', async () => {
      supportTicketFindFirst.mockResolvedValue(null);

      // 404 and not 403: a 403 would confirm the id names a real ticket to a
      // caller with no right to know that.
      await expect(
        service.findOneForOrganizationAdmin(TICKET_ID, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('approveQuotaException', () => {
    it('grants permission instead of creating a booking', async () => {
      const result = await service.approveQuotaException(
        TICKET_ID,
        APPROVE_DTO,
        ORGANIZATION_ID,
        ADMIN_ID,
      );

      expect(result).toEqual({
        ticketId: TICKET_ID,
        status: TicketStatus.CLOSED,
        grantId: GRANT_ID,
        decidedAt: NOW,
      });
      // TicketType.OTHER in the filter is what stops these routes minting a
      // booth grant out of an issue report, which also carries a bookingId.
      expect(supportTicketFindFirst).toHaveBeenCalledWith({
        where: {
          id: TICKET_ID,
          organizationId: ORGANIZATION_ID,
          type: TicketType.OTHER,
        },
        select: {
          id: true,
          userId: true,
          status: true,
          booking: { select: { eventId: true } },
        },
      });
      expect(supportTicketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: TICKET_ID,
          organizationId: ORGANIZATION_ID,
          status: { in: [TicketStatus.OPEN, TicketStatus.PROCESSING] },
        },
        data: { status: TicketStatus.CLOSED },
      });
      expect(quotaGrantCreate).toHaveBeenCalledWith({
        data: {
          vendorUserId: VENDOR_ID,
          eventId: EVENT_ID,
          organizationId: ORGANIZATION_ID,
          sourceTicketId: TICKET_ID,
          grantedByUserId: ADMIN_ID,
        },
        select: { id: true },
      });
    });

    it('writes the audit trail and tells the vendor to pick a booth themselves', async () => {
      await service.approveQuotaException(
        TICKET_ID,
        APPROVE_DTO,
        ORGANIZATION_ID,
        ADMIN_ID,
      );

      expect(recordAuditLog).toHaveBeenCalledWith({
        actorUserId: ADMIN_ID,
        action: 'QUOTA_EXCEPTION_APPROVED',
        targetType: 'SUPPORT_TICKET',
        targetId: TICKET_ID,
        metadata: {
          previousStatus: TicketStatus.OPEN,
          newStatus: TicketStatus.CLOSED,
          grantId: GRANT_ID,
          vendorUserId: VENDOR_ID,
          eventId: EVENT_ID,
          organizationId: ORGANIZATION_ID,
          reason: APPROVE_DTO.reason,
        },
      });
      // The old copy claimed a booking had already been made for them. It must
      // not survive: nothing is booked until the vendor books it.
      expect(createForUser).toHaveBeenCalledWith(VENDOR_ID, {
        type: NotificationType.SUPPORT_TICKET,
        title: 'คำร้องขอเพิ่มโควตาได้รับการอนุมัติแล้ว',
        body: 'คุณสามารถกลับไปเลือกบูธที่ต้องการได้ด้วยตนเอง โดยใช้สิทธิ์ได้จนกว่างานจะปิดรับจอง',
        relatedEntityType: 'SUPPORT_TICKET',
        relatedEntityId: TICKET_ID,
      });
    });

    it('records a null reason when the admin gave none', async () => {
      await service.approveQuotaException(
        TICKET_ID,
        {},
        ORGANIZATION_ID,
        ADMIN_ID,
      );

      const [auditArgs] = recordAuditLog.mock.calls[0] as [
        { metadata: { reason: string | null } },
      ];
      expect(auditArgs.metadata.reason).toBeNull();
    });

    it('approves a ticket that is already being processed', async () => {
      supportTicketFindFirst.mockResolvedValue({
        id: TICKET_ID,
        userId: VENDOR_ID,
        status: TicketStatus.PROCESSING,
        booking: { eventId: EVENT_ID },
      });

      await expect(
        service.approveQuotaException(
          TICKET_ID,
          APPROVE_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
      ).resolves.toMatchObject({ grantId: GRANT_ID });
    });

    it('rejects a ticket that is already closed', async () => {
      supportTicketFindFirst.mockResolvedValue({
        id: TICKET_ID,
        userId: VENDOR_ID,
        status: TicketStatus.CLOSED,
        booking: { eventId: EVENT_ID },
      });

      await expect(
        service.approveQuotaException(
          TICKET_ID,
          APPROVE_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
      expect(quotaGrantCreate).not.toHaveBeenCalled();
      expect(createForUser).not.toHaveBeenCalled();
      expect(recordAuditLog).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing or out-of-organization ticket', async () => {
      supportTicketFindFirst.mockResolvedValue(null);

      await expect(
        service.approveQuotaException(
          TICKET_ID,
          APPROVE_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
      expect(quotaGrantCreate).not.toHaveBeenCalled();
    });

    it('refuses a legacy ticket that names no event', async () => {
      supportTicketFindFirst.mockResolvedValue({
        id: TICKET_ID,
        userId: VENDOR_ID,
        status: TicketStatus.OPEN,
        booking: null,
      });

      await expect(
        service.approveQuotaException(
          TICKET_ID,
          APPROVE_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
      expect(quotaGrantCreate).not.toHaveBeenCalled();
    });

    it('lets only one of two concurrent approvals grant', async () => {
      supportTicketUpdateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const [winner, loser] = await Promise.allSettled([
        service.approveQuotaException(
          TICKET_ID,
          APPROVE_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
        service.approveQuotaException(
          TICKET_ID,
          APPROVE_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
      ]);

      expect(winner.status).toBe('fulfilled');
      expect(loser.status).toBe('rejected');
      if (loser.status === 'rejected') {
        expect(loser.reason).toBeInstanceOf(ConflictException);
        expect(loser.reason).toMatchObject({
          message: 'คำร้องนี้ถูกปิดไปแล้ว',
        });
      }
      expect(quotaGrantCreate).toHaveBeenCalledTimes(1);
      expect(createForUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('rejectQuotaException', () => {
    it('closes the ticket without granting anything', async () => {
      const result = await service.rejectQuotaException(
        TICKET_ID,
        REJECT_DTO,
        ORGANIZATION_ID,
        ADMIN_ID,
      );

      expect(result).toEqual({
        ticketId: TICKET_ID,
        status: TicketStatus.CLOSED,
        grantId: null,
        decidedAt: NOW,
      });
      expect(quotaGrantCreate).not.toHaveBeenCalled();
      expect(supportTicketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: TICKET_ID,
          organizationId: ORGANIZATION_ID,
          status: { in: [TicketStatus.OPEN, TicketStatus.PROCESSING] },
        },
        data: { status: TicketStatus.CLOSED },
      });
    });

    it('audits the rejection and passes the reason to the vendor verbatim', async () => {
      await service.rejectQuotaException(
        TICKET_ID,
        REJECT_DTO,
        ORGANIZATION_ID,
        ADMIN_ID,
      );

      expect(recordAuditLog).toHaveBeenCalledWith({
        actorUserId: ADMIN_ID,
        action: 'QUOTA_EXCEPTION_REJECTED',
        targetType: 'SUPPORT_TICKET',
        targetId: TICKET_ID,
        metadata: {
          previousStatus: TicketStatus.OPEN,
          newStatus: TicketStatus.CLOSED,
          vendorUserId: VENDOR_ID,
          organizationId: ORGANIZATION_ID,
          reason: REJECT_DTO.reason,
        },
      });
      expect(createForUser).toHaveBeenCalledWith(VENDOR_ID, {
        type: NotificationType.SUPPORT_TICKET,
        title: 'คำร้องขอเพิ่มโควตาไม่ได้รับการอนุมัติ',
        body: REJECT_DTO.reason,
        relatedEntityType: 'SUPPORT_TICKET',
        relatedEntityId: TICKET_ID,
      });
    });

    it('rejects a ticket that is already closed', async () => {
      supportTicketFindFirst.mockResolvedValue({
        id: TICKET_ID,
        userId: VENDOR_ID,
        status: TicketStatus.CLOSED,
        booking: { eventId: EVENT_ID },
      });

      await expect(
        service.rejectQuotaException(
          TICKET_ID,
          REJECT_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
      expect(recordAuditLog).not.toHaveBeenCalled();
      expect(createForUser).not.toHaveBeenCalled();
    });

    it('answers 404 for a ticket belonging to another organization', async () => {
      supportTicketFindFirst.mockResolvedValue(null);

      await expect(
        service.rejectQuotaException(
          TICKET_ID,
          REJECT_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(supportTicketUpdateMany).not.toHaveBeenCalled();
    });

    it('lets only one of two concurrent rejections close the ticket', async () => {
      supportTicketUpdateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const [winner, loser] = await Promise.allSettled([
        service.rejectQuotaException(
          TICKET_ID,
          REJECT_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
        service.rejectQuotaException(
          TICKET_ID,
          REJECT_DTO,
          ORGANIZATION_ID,
          ADMIN_ID,
        ),
      ]);

      expect(winner.status).toBe('fulfilled');
      expect(loser.status).toBe('rejected');
      expect(createForUser).toHaveBeenCalledTimes(1);
    });
  });
});
