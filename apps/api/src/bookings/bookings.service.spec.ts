import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BoothStatus,
  CancelledByRole,
  EventStatus,
  NotificationType,
  OrgStatus,
  Prisma,
  SlipStatus,
  UserRole,
  type Booking,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import generatePromptPayPayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SlipVerificationService } from '../slips/slip-verification.service';
import {
  BookingSlipStorageService,
  type UploadedSlipFile,
} from './booking-slip-storage.service';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ConfirmExemptBookingDto } from './dto/confirm-exempt-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

jest.mock('promptpay-qr', () => ({
  __esModule: true,
  default: jest.fn(() => 'promptpay-payload'),
}));

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,cXI='),
  },
}));

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const BOOTH_ID = '22222222-2222-4222-8222-222222222222';
const SHOP_ID = '33333333-3333-4333-8333-333333333333';
const VENDOR_ID = '44444444-4444-4444-8444-444444444444';
const VENUE_ID = '55555555-5555-4555-8555-555555555555';
const ORGANIZATION_ID = '66666666-6666-4666-8666-666666666666';
const BOOKING_ID = '77777777-7777-4777-8777-777777777777';
const ADMIN_ID = '99999999-9999-4999-8999-999999999999';
const BOOKING_CODE = 'BK-0123456789AB';
const EVENT_START = new Date('2026-09-10T00:00:00.000Z');
const EVENT_END = new Date('2026-09-12T00:00:00.000Z');
const NOW = new Date('2026-08-02T00:00:00.000Z');
const BOOTH_PRICE = new Prisma.Decimal('1500.00');
const SIGNED_SLIP_URL =
  'https://project.supabase.co/storage/v1/object/sign/slips/path?token=secret';
const SLIP_OBJECT_PATH = `${VENDOR_ID}/${BOOKING_ID}/stored-slip.jpg`;
const SLIP_FILE: UploadedSlipFile = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
};

const CREATE_DTO: CreateBookingDto = {
  eventId: EVENT_ID,
  boothId: BOOTH_ID,
  shopId: SHOP_ID,
};
const CANCEL_DTO: CancelBookingDto = {
  cancelReason: 'ไม่สามารถเข้าร่วมงานได้',
};
const EXEMPT_DTO: ConfirmExemptBookingDto = {
  paymentExemptReason: 'ผู้ขายชำระเงินสดหน้างานแล้ว',
};

const CREATED_BOOKING: Booking = {
  id: BOOKING_ID,
  bookingCode: 'BK-0123456789AB',
  eventId: EVENT_ID,
  boothId: BOOTH_ID,
  shopId: SHOP_ID,
  vendorUserId: VENDOR_ID,
  bookingStartDate: EVENT_START,
  bookingEndDate: EVENT_END,
  boothPrice: BOOTH_PRICE,
  isPaymentExempt: false,
  paymentExemptReason: null,
  status: BookingStatus.PENDING_PAYMENT,
  holdExpiresAt: new Date('2026-08-02T00:05:00.000Z'),
  confirmedAt: null,
  cancelledByUserId: null,
  cancelledByRole: null,
  cancelReason: null,
  cancelledAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const ADMIN_BOOKING = {
  ...CREATED_BOOKING,
  event: {
    id: EVENT_ID,
    name: 'ตลาดนัดสร้างสรรค์',
    organizationId: ORGANIZATION_ID,
    organization: { id: ORGANIZATION_ID, name: 'มหาวิทยาลัยสเปซลิงก์' },
  },
  shop: { id: SHOP_ID, name: 'ร้านของปอนด์' },
  vendor: {
    id: VENDOR_ID,
    email: 'vendor@example.com',
    fullName: 'Vendor One',
  },
  booth: {
    id: BOOTH_ID,
    code: 'A01',
    zone: {
      id: '88888888-8888-4888-8888-888888888888',
      code: 'A',
      name: 'อาหารและเครื่องดื่ม',
    },
  },
};

const ADMIN_BOOKING_INCLUDE = {
  event: {
    select: {
      id: true,
      name: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  },
  shop: { select: { id: true, name: true } },
  vendor: { select: { id: true, email: true, fullName: true } },
  booth: {
    select: {
      id: true,
      code: true,
      zone: { select: { id: true, code: true, name: true } },
    },
  },
};

const eventFindUnique = jest.fn();
const boothFindUnique = jest.fn();
const shopFindFirst = jest.fn();
const userFindUnique = jest.fn();
const bookingFindFirst = jest.fn();
const bookingCount = jest.fn();
const bookingCreate = jest.fn();
const bookingFindUnique = jest.fn();
const bookingFindMany = jest.fn();
const platformConfigFindFirst = jest.fn();
const bookingUpdateMany = jest.fn();
const verifiedSlipFindFirst = jest.fn();
const verifySlip = jest.fn();
const uploadForVerification = jest.fn();
const removeObject = jest.fn();
const createAdminAccess = jest.fn();
const prismaTransaction = jest.fn();
const createForUser = jest.fn();

const mockPrismaService = {
  event: { findUnique: eventFindUnique },
  booth: { findUnique: boothFindUnique },
  shop: { findFirst: shopFindFirst },
  user: { findUnique: userFindUnique },
  booking: {
    findFirst: bookingFindFirst,
    count: bookingCount,
    create: bookingCreate,
    findUnique: bookingFindUnique,
    findMany: bookingFindMany,
    updateMany: bookingUpdateMany,
  },
  verifiedSlip: { findFirst: verifiedSlipFindFirst },
  platformConfig: { findFirst: platformConfigFindFirst },
  $transaction: prismaTransaction,
};
const mockSlipVerificationService = { verify: verifySlip };
const mockSlipStorageService = {
  createAdminAccess,
  removeObject,
  uploadForVerification,
};
const mockNotificationsService = { createForUser };

const PENDING_SLIP_BOOKING = {
  id: BOOKING_ID,
  bookingCode: BOOKING_CODE,
  status: BookingStatus.PENDING_PAYMENT,
  boothPrice: BOOTH_PRICE,
  holdExpiresAt: new Date('2026-08-02T00:05:00.000Z'),
  confirmedAt: null,
  event: { status: EventStatus.PUBLISHED, endDate: EVENT_END },
  booth: { status: BoothStatus.AVAILABLE },
};

function bookingCreateData(): Prisma.BookingUncheckedCreateInput {
  const [args] = bookingCreate.mock.calls[0] as [
    { data: Prisma.BookingUncheckedCreateInput },
  ];
  return args.data;
}

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();

    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(mockPrismaService as unknown as Prisma.TransactionClient),
    );

    eventFindUnique.mockResolvedValue({
      id: EVENT_ID,
      status: EventStatus.PUBLISHED,
      organizationId: ORGANIZATION_ID,
      venueId: VENUE_ID,
      startDate: EVENT_START,
      endDate: EVENT_END,
      organization: {
        status: OrgStatus.ACTIVE,
        orgConfig: { bookingQuotaPerVendor: 3 },
      },
    });
    boothFindUnique.mockResolvedValue({
      id: BOOTH_ID,
      status: BoothStatus.AVAILABLE,
      boothPrice: BOOTH_PRICE,
      zone: { venueId: VENUE_ID },
    });
    shopFindFirst.mockResolvedValue({ id: SHOP_ID });
    userFindUnique.mockResolvedValue({ isBlacklisted: false });
    bookingFindFirst.mockResolvedValue(null);
    bookingCount.mockResolvedValue(0);
    bookingCreate.mockResolvedValue(CREATED_BOOKING);
    bookingFindUnique.mockResolvedValue({
      ...CREATED_BOOKING,
      status: BookingStatus.CANCELLED,
      cancelledByUserId: VENDOR_ID,
      cancelledByRole: CancelledByRole.VENDOR,
      cancelReason: CANCEL_DTO.cancelReason,
      cancelledAt: NOW,
    });
    bookingFindMany.mockResolvedValue([]);
    bookingUpdateMany.mockResolvedValue({ count: 1 });
    platformConfigFindFirst.mockResolvedValue({ defaultBookingQuota: 2 });
    verifySlip.mockResolvedValue({
      status: SlipStatus.VERIFIED,
      amount: new Prisma.Decimal('1500.00'),
    });
    uploadForVerification.mockResolvedValue({
      objectPath: SLIP_OBJECT_PATH,
      verificationUrl: SIGNED_SLIP_URL,
    });
    removeObject.mockResolvedValue(undefined);
    createForUser.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: SlipVerificationService,
          useValue: mockSlipVerificationService,
        },
        {
          provide: BookingSlipStorageService,
          useValue: mockSlipStorageService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a pending-payment booking with server-owned values', async () => {
    const result = await service.create(CREATE_DTO, VENDOR_ID);

    expect(result).toEqual({ ...CREATED_BOOKING, boothPrice: '1500' });

    const data = bookingCreateData();
    expect(data.bookingCode).toMatch(/^BK-[A-F0-9]{12}$/);
    expect(data.eventId).toBe(EVENT_ID);
    expect(data.boothId).toBe(BOOTH_ID);
    expect(data.shopId).toBe(SHOP_ID);
    expect(data.vendorUserId).toBe(VENDOR_ID);
    expect(data.bookingStartDate).toBe(EVENT_START);
    expect(data.bookingEndDate).toBe(EVENT_END);
    expect(data.boothPrice).toBe(BOOTH_PRICE);
    expect(data.isPaymentExempt).toBe(false);
    expect(data.status).toBe(BookingStatus.PENDING_PAYMENT);
    expect(data.holdExpiresAt).toEqual(new Date('2026-08-02T00:05:00.000Z'));
    expect(shopFindFirst).toHaveBeenCalledWith({
      where: { id: SHOP_ID, ownerUserId: VENDOR_ID },
      select: { id: true },
    });
    expect(prismaTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(createForUser).toHaveBeenCalledTimes(1);
    expect(createForUser).toHaveBeenCalledWith(VENDOR_ID, {
      type: NotificationType.BOOKING_STATUS,
      title: 'สร้างการจองสำเร็จ',
      body: `ระบบสร้าง Booking ${BOOKING_CODE} แล้ว กรุณาชำระเงินและแนบสลิปภายในเวลาที่กำหนด`,
      relatedEntityType: 'BOOKING',
      relatedEntityId: BOOKING_ID,
    });
  });

  it('keeps booking creation successful when notification delivery fails', async () => {
    createForUser.mockRejectedValueOnce(new Error('notification unavailable'));

    await expect(service.create(CREATE_DTO, VENDOR_ID)).resolves.toEqual({
      ...CREATED_BOOKING,
      boothPrice: '1500',
    });
    expect(createForUser).toHaveBeenCalledTimes(1);
  });

  it('rejects a blacklisted vendor before creating a booking', async () => {
    userFindUnique.mockResolvedValue({ isBlacklisted: true });

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(bookingFindFirst).not.toHaveBeenCalled();
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('rejects booking creation when the organization is not active', async () => {
    eventFindUnique.mockResolvedValue({
      id: EVENT_ID,
      status: EventStatus.PUBLISHED,
      organizationId: ORGANIZATION_ID,
      venueId: VENUE_ID,
      startDate: EVENT_START,
      endDate: EVENT_END,
      organization: {
        status: OrgStatus.SUSPENDED,
        orgConfig: { bookingQuotaPerVendor: 3 },
      },
    });

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
      'องค์กรนี้ถูกระงับการใช้งานชั่วคราว',
    );
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it.each([EventStatus.DRAFT, EventStatus.COMPLETED, EventStatus.CANCELLED])(
    'rejects an event in %s status',
    async (status) => {
      eventFindUnique.mockResolvedValue({
        id: EVENT_ID,
        status,
        organizationId: ORGANIZATION_ID,
        venueId: VENUE_ID,
        startDate: EVENT_START,
        endDate: EVENT_END,
        organization: {
          status: OrgStatus.ACTIVE,
          orgConfig: { bookingQuotaPerVendor: 3 },
        },
      });

      await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
        'อีเวนต์นี้ยังไม่เปิดให้จอง',
      );
      expect(bookingCreate).not.toHaveBeenCalled();
    },
  );

  it('rejects a published event after its final Bangkok calendar day', async () => {
    eventFindUnique.mockResolvedValue({
      id: EVENT_ID,
      status: EventStatus.PUBLISHED,
      organizationId: ORGANIZATION_ID,
      venueId: VENUE_ID,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-01T00:00:00.000Z'),
      organization: {
        status: OrgStatus.ACTIVE,
        orgConfig: { bookingQuotaPerVendor: 3 },
      },
    });

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
      'อีเวนต์นี้สิ้นสุดแล้ว',
    );
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('keeps an ongoing event bookable through its final Bangkok calendar day', async () => {
    jest.setSystemTime(new Date('2026-09-11T18:00:00.000Z'));
    eventFindUnique.mockResolvedValue({
      id: EVENT_ID,
      status: EventStatus.ONGOING,
      organizationId: ORGANIZATION_ID,
      venueId: VENUE_ID,
      startDate: EVENT_START,
      endDate: EVENT_END,
      organization: {
        status: OrgStatus.ACTIVE,
        orgConfig: { bookingQuotaPerVendor: 3 },
      },
    });

    await expect(service.create(CREATE_DTO, VENDOR_ID)).resolves.toEqual({
      ...CREATED_BOOKING,
      boothPrice: '1500',
    });
  });

  it.each([BoothStatus.BOOKED, BoothStatus.MAINTENANCE, BoothStatus.INACTIVE])(
    'rejects a booth in %s status',
    async (status) => {
      boothFindUnique.mockResolvedValue({
        id: BOOTH_ID,
        status,
        boothPrice: BOOTH_PRICE,
        zone: { venueId: VENUE_ID },
      });

      await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
        'บูธนี้ไม่พร้อมให้จอง',
      );
      expect(bookingCreate).not.toHaveBeenCalled();
    },
  );

  it('rejects a booth that belongs to another venue', async () => {
    boothFindUnique.mockResolvedValue({
      id: BOOTH_ID,
      status: BoothStatus.AVAILABLE,
      boothPrice: BOOTH_PRICE,
      zone: { venueId: '88888888-8888-4888-8888-888888888888' },
    });

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(bookingFindFirst).not.toHaveBeenCalled();
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('rejects an active booking for the same event and booth', async () => {
    bookingFindFirst.mockResolvedValue({ id: 'existing-booking' });

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
      'บูธนี้ถูกจองไปแล้ว',
    );
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
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('translates a create-time P2002 race into a booking conflict', async () => {
    bookingCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
      'บูธนี้ถูกจองไปแล้ว',
    );
  });

  it('retries a serializable transaction conflict before creating', async () => {
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict',
      { code: 'P2034', clientVersion: 'test' },
    );
    prismaTransaction
      .mockRejectedValueOnce(serializationError)
      .mockImplementationOnce(
        (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          operation(mockPrismaService as unknown as Prisma.TransactionClient),
      );

    await expect(service.create(CREATE_DTO, VENDOR_ID)).resolves.toEqual({
      ...CREATED_BOOKING,
      boothPrice: '1500',
    });
    expect(prismaTransaction).toHaveBeenCalledTimes(2);
    expect(bookingCreate).toHaveBeenCalledTimes(1);
    expect(createForUser).toHaveBeenCalledTimes(1);
  });

  it('rejects a vendor who has reached the organization quota', async () => {
    eventFindUnique.mockResolvedValue({
      id: EVENT_ID,
      status: EventStatus.PUBLISHED,
      organizationId: ORGANIZATION_ID,
      venueId: VENUE_ID,
      startDate: EVENT_START,
      endDate: EVENT_END,
      organization: {
        status: OrgStatus.ACTIVE,
        orgConfig: { bookingQuotaPerVendor: 2 },
      },
    });
    bookingCount.mockResolvedValue(2);

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toThrow(
      'คุณจองบูธในงานนี้ครบโควตาแล้ว',
    );
    expect(bookingCount).toHaveBeenCalledWith({
      where: {
        eventId: EVENT_ID,
        vendorUserId: VENDOR_ID,
        status: {
          in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
        },
      },
    });
    expect(platformConfigFindFirst).not.toHaveBeenCalled();
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  it('falls back to the platform quota when the organization has none', async () => {
    eventFindUnique.mockResolvedValue({
      id: EVENT_ID,
      status: EventStatus.PUBLISHED,
      organizationId: ORGANIZATION_ID,
      venueId: VENUE_ID,
      startDate: EVENT_START,
      endDate: EVENT_END,
      organization: { status: OrgStatus.ACTIVE, orgConfig: null },
    });
    platformConfigFindFirst.mockResolvedValue({ defaultBookingQuota: 1 });
    bookingCount.mockResolvedValue(1);

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(platformConfigFindFirst).toHaveBeenCalledWith({
      orderBy: { updatedAt: 'desc' },
      select: { defaultBookingQuota: true },
    });
  });

  it('returns 404 when the shop does not belong to the vendor', async () => {
    shopFindFirst.mockResolvedValue(null);

    await expect(service.create(CREATE_DTO, VENDOR_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(bookingCreate).not.toHaveBeenCalled();
  });

  describe('createForAdmin', () => {
    it('does not let a quota exception bypass the blacklist', async () => {
      userFindUnique.mockResolvedValue({ isBlacklisted: true });

      await expect(
        service.createForAdmin(CREATE_DTO, VENDOR_ID, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bookingFindFirst).not.toHaveBeenCalled();
      expect(bookingCreate).not.toHaveBeenCalled();
    });

    // The approved end of a quota exception. The default event mock allows 3
    // per vendor and the vendor already holds 5 — the vendor path would refuse
    // this outright (see 'rejects a vendor who has reached the organization
    // quota'), and this path must not.
    it('creates a booking for a vendor already over the quota', async () => {
      bookingCount.mockResolvedValue(5);

      await expect(
        service.createForAdmin(CREATE_DTO, VENDOR_ID, ORGANIZATION_ID),
      ).resolves.toEqual({ ...CREATED_BOOKING, boothPrice: '1500' });

      expect(bookingCreate).toHaveBeenCalledTimes(1);
      const data = bookingCreateData();
      // Booked for the vendor named in the argument, not for whoever approved
      // it, and on the ordinary pending-payment path — an exception to the
      // quota is not an exemption from paying.
      expect(data.vendorUserId).toBe(VENDOR_ID);
      expect(data.status).toBe(BookingStatus.PENDING_PAYMENT);
      expect(data.isPaymentExempt).toBe(false);
    });

    it('returns 404 without writing when the event belongs to another organization', async () => {
      eventFindUnique.mockResolvedValue({
        id: EVENT_ID,
        status: EventStatus.PUBLISHED,
        organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        venueId: VENUE_ID,
        startDate: EVENT_START,
        endDate: EVENT_END,
        organization: {
          status: OrgStatus.ACTIVE,
          orgConfig: { bookingQuotaPerVendor: 3 },
        },
      });

      await expect(
        service.createForAdmin(CREATE_DTO, VENDOR_ID, ORGANIZATION_ID),
      ).rejects.toThrow(new NotFoundException('ไม่พบอีเวนต์'));

      expect(bookingFindFirst).not.toHaveBeenCalled();
      expect(bookingCount).not.toHaveBeenCalled();
      expect(bookingCreate).not.toHaveBeenCalled();
    });

    // Quota is the only invariant waived. The rest of createWithinTransaction
    // still runs, so an admin cannot double-book a booth by approving a ticket.
    it('still refuses a booth with an active booking', async () => {
      bookingCount.mockResolvedValue(5);
      bookingFindFirst.mockResolvedValue({ id: 'existing-booking' });

      await expect(
        service.createForAdmin(CREATE_DTO, VENDOR_ID, ORGANIZATION_ID),
      ).rejects.toThrow('บูธนี้ถูกจองไปแล้ว');
      expect(bookingCreate).not.toHaveBeenCalled();
    });

    it('still refuses a booth in another venue', async () => {
      bookingCount.mockResolvedValue(5);
      boothFindUnique.mockResolvedValue({
        id: BOOTH_ID,
        status: BoothStatus.AVAILABLE,
        boothPrice: BOOTH_PRICE,
        zone: { venueId: '88888888-8888-4888-8888-888888888888' },
      });

      await expect(
        service.createForAdmin(CREATE_DTO, VENDOR_ID, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingCreate).not.toHaveBeenCalled();
    });

    it('keeps the serializable retry the vendor path has', async () => {
      const serializationError = new Prisma.PrismaClientKnownRequestError(
        'Transaction write conflict',
        { code: 'P2034', clientVersion: 'test' },
      );
      prismaTransaction
        .mockRejectedValueOnce(serializationError)
        .mockImplementationOnce(
          (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
            operation(mockPrismaService as unknown as Prisma.TransactionClient),
        );

      await expect(
        service.createForAdmin(CREATE_DTO, VENDOR_ID, ORGANIZATION_ID),
      ).resolves.toMatchObject({ id: BOOKING_ID });
      expect(prismaTransaction).toHaveBeenCalledTimes(2);
      expect(bookingCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadSlip', () => {
    beforeEach(() => {
      bookingFindFirst.mockResolvedValue(PENDING_SLIP_BOOKING);
    });

    it('returns 404 for a missing booking or another vendor booking', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: { id: BOOKING_ID, vendorUserId: VENDOR_ID },
        select: {
          id: true,
          bookingCode: true,
          status: true,
          boothPrice: true,
          holdExpiresAt: true,
          confirmedAt: true,
          event: { select: { status: true, endDate: true } },
          booth: { select: { status: true } },
        },
      });
      expect(uploadForVerification).not.toHaveBeenCalled();
      expect(verifySlip).not.toHaveBeenCalled();
    });

    it('rejects a booking that is no longer pending payment', async () => {
      bookingFindFirst.mockResolvedValue({
        ...PENDING_SLIP_BOOKING,
        status: BookingStatus.CONFIRMED,
      });

      await expect(
        service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(uploadForVerification).not.toHaveBeenCalled();
    });

    it.each([EventStatus.DRAFT, EventStatus.COMPLETED, EventStatus.CANCELLED])(
      'rejects slip confirmation after the event becomes %s',
      async (status) => {
        bookingFindFirst.mockResolvedValue({
          ...PENDING_SLIP_BOOKING,
          event: { status, endDate: EVENT_END },
        });

        await expect(
          service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID),
        ).rejects.toThrow('อีเวนต์นี้ไม่เปิดรับการจองแล้ว');
        expect(uploadForVerification).not.toHaveBeenCalled();
      },
    );

    it('rejects slip confirmation after the event final day', async () => {
      bookingFindFirst.mockResolvedValue({
        ...PENDING_SLIP_BOOKING,
        event: {
          status: EventStatus.PUBLISHED,
          endDate: new Date('2026-08-01T00:00:00.000Z'),
        },
      });

      await expect(
        service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID),
      ).rejects.toThrow('อีเวนต์นี้สิ้นสุดแล้ว');
      expect(uploadForVerification).not.toHaveBeenCalled();
    });

    it.each([
      BoothStatus.BOOKED,
      BoothStatus.MAINTENANCE,
      BoothStatus.INACTIVE,
    ])(
      'rejects slip confirmation after the booth becomes %s',
      async (status) => {
        bookingFindFirst.mockResolvedValue({
          ...PENDING_SLIP_BOOKING,
          booth: { status },
        });

        await expect(
          service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID),
        ).rejects.toThrow('บูธนี้ไม่พร้อมสำหรับการจองแล้ว');
        expect(uploadForVerification).not.toHaveBeenCalled();
      },
    );

    it('rejects a booking whose payment hold has expired', async () => {
      bookingFindFirst.mockResolvedValue({
        ...PENDING_SLIP_BOOKING,
        holdExpiresAt: NOW,
      });

      await expect(
        service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID),
      ).rejects.toThrow('หมดเวลาชำระเงินสำหรับการจองนี้แล้ว');
      expect(uploadForVerification).not.toHaveBeenCalled();
    });

    it('confirms when VERIFIED is returned with an equal Decimal amount', async () => {
      verifySlip.mockResolvedValue({
        status: SlipStatus.VERIFIED,
        amount: new Prisma.Decimal('1500.00'),
        transRef: 'sensitive-reference',
        senderName: 'Sensitive Payer Name',
        receiverName: 'Sensitive Receiver Name',
        sendingBank: 'Sensitive Bank',
        raw: { secret: 'provider payload' },
      });

      const result = await service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID);

      expect(uploadForVerification).toHaveBeenCalledWith(
        SLIP_FILE,
        BOOKING_ID,
        VENDOR_ID,
      );
      expect(verifySlip).toHaveBeenCalledWith(
        {
          bookingId: BOOKING_ID,
          slipImageUrl: SIGNED_SLIP_URL,
          storedObjectPath: SLIP_OBJECT_PATH,
          expectedAmount: BOOTH_PRICE,
        },
        mockPrismaService,
      );
      expect(bookingUpdateMany).toHaveBeenCalledWith({
        where: {
          id: BOOKING_ID,
          vendorUserId: VENDOR_ID,
          status: BookingStatus.PENDING_PAYMENT,
          holdExpiresAt: { gt: NOW },
        },
        data: {
          status: BookingStatus.CONFIRMED,
          confirmedAt: NOW,
        },
      });
      expect(result).toEqual({
        booking: {
          id: BOOKING_ID,
          status: BookingStatus.CONFIRMED,
          confirmedAt: NOW,
          holdExpiresAt: PENDING_SLIP_BOOKING.holdExpiresAt,
        },
        verification: {
          status: SlipStatus.VERIFIED,
          message: 'ตรวจสอบสลิปสำเร็จ',
        },
      });
      expect(JSON.stringify(result)).not.toContain('Sensitive');
      expect(JSON.stringify(result)).not.toContain('secret');
      expect(JSON.stringify(result)).not.toContain('token=');
      expect(createForUser).toHaveBeenCalledTimes(1);
      expect(createForUser).toHaveBeenCalledWith(VENDOR_ID, {
        type: NotificationType.PAYMENT,
        title: 'ชำระเงินสำเร็จ',
        body: `ระบบตรวจสอบการชำระเงินของ Booking ${BOOKING_CODE} เรียบร้อยแล้ว การจองได้รับการยืนยัน`,
        relatedEntityType: 'BOOKING',
        relatedEntityId: BOOKING_ID,
      });
    });

    it('keeps confirmation successful when notification delivery fails', async () => {
      createForUser.mockRejectedValueOnce(
        new Error('notification unavailable'),
      );

      await expect(
        service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID),
      ).resolves.toMatchObject({
        booking: { status: BookingStatus.CONFIRMED },
        verification: { status: SlipStatus.VERIFIED },
      });
      expect(createForUser).toHaveBeenCalledTimes(1);
    });

    it.each([SlipStatus.INVALID, SlipStatus.DUPLICATE, SlipStatus.ERROR])(
      'keeps the booking pending when verification returns %s',
      async (status) => {
        verifySlip.mockResolvedValue({
          status,
          amount: new Prisma.Decimal('1500.00'),
          message: 'provider detail must not reach the vendor',
        });

        const result = await service.uploadSlip(
          BOOKING_ID,
          SLIP_FILE,
          VENDOR_ID,
        );

        expect(result.booking.status).toBe(BookingStatus.PENDING_PAYMENT);
        expect(result.verification.status).toBe(status);
        expect(result.verification.message).not.toContain('provider detail');
        expect(bookingUpdateMany).not.toHaveBeenCalled();
        expect(createForUser).not.toHaveBeenCalled();
      },
    );

    it('keeps pending and reports INVALID when a verified amount is wrong', async () => {
      verifySlip.mockResolvedValue({
        status: SlipStatus.VERIFIED,
        amount: new Prisma.Decimal('1499.99'),
      });

      const result = await service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID);

      expect(result.booking.status).toBe(BookingStatus.PENDING_PAYMENT);
      expect(result.verification).toEqual({
        status: SlipStatus.INVALID,
        message: 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
      });
      expect(bookingUpdateMany).not.toHaveBeenCalled();
      expect(createForUser).not.toHaveBeenCalled();
    });

    it('does not confirm a VERIFIED result with no amount', async () => {
      verifySlip.mockResolvedValue({ status: SlipStatus.VERIFIED });

      const result = await service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID);

      expect(result.verification.status).toBe(SlipStatus.INVALID);
      expect(bookingUpdateMany).not.toHaveBeenCalled();
      expect(createForUser).not.toHaveBeenCalled();
    });

    it('maps a duplicate transaction P2002 to DUPLICATE', async () => {
      verifySlip.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID);

      expect(result.verification).toEqual({
        status: SlipStatus.DUPLICATE,
        message: 'สลิปนี้ถูกใช้แล้ว',
      });
      expect(bookingUpdateMany).not.toHaveBeenCalled();
      expect(removeObject).toHaveBeenCalledWith(SLIP_OBJECT_PATH);
      expect(createForUser).not.toHaveBeenCalled();
    });

    it('returns a sanitized ERROR when the verifier throws', async () => {
      verifySlip.mockRejectedValue(
        new Error(`SlipOK failed for ${SIGNED_SLIP_URL}`),
      );

      const result = await service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID);

      expect(result.verification).toEqual({
        status: SlipStatus.ERROR,
        message: 'ไม่สามารถตรวจสอบสลิปได้ กรุณาลองใหม่',
      });
      expect(JSON.stringify(result)).not.toContain(SIGNED_SLIP_URL);
      expect(bookingUpdateMany).not.toHaveBeenCalled();
      expect(removeObject).toHaveBeenCalledWith(SLIP_OBJECT_PATH);
      expect(createForUser).not.toHaveBeenCalled();
    });

    it('does not confirm if the booking changed during verification', async () => {
      bookingUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.uploadSlip(BOOKING_ID, SLIP_FILE, VENDOR_ID),
      ).rejects.toThrow('การจองหมดเวลาหรือสถานะเปลี่ยนไปแล้ว');
      expect(removeObject).toHaveBeenCalledWith(SLIP_OBJECT_PATH);
      expect(createForUser).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status: BookingStatus.CONFIRMED,
        holdExpiresAt: null,
        bookingStartDate: EVENT_START,
      });
    });

    it('cancels an owned active booking as the vendor', async () => {
      const result = await service.cancel(BOOKING_ID, CANCEL_DTO, VENDOR_ID);

      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: { id: BOOKING_ID, vendorUserId: VENDOR_ID },
        select: {
          id: true,
          status: true,
          holdExpiresAt: true,
          bookingStartDate: true,
        },
      });
      expect(bookingUpdateMany).toHaveBeenCalledWith({
        where: {
          id: BOOKING_ID,
          vendorUserId: VENDOR_ID,
          OR: [
            { status: BookingStatus.CONFIRMED },
            {
              status: BookingStatus.PENDING_PAYMENT,
              holdExpiresAt: { gt: NOW },
            },
          ],
          bookingStartDate: { gt: NOW },
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledByUserId: VENDOR_ID,
          cancelledByRole: CancelledByRole.VENDOR,
          cancelReason: CANCEL_DTO.cancelReason,
          cancelledAt: NOW,
        },
      });
      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(result.cancelledByRole).toBe(CancelledByRole.VENDOR);
      expect(result.boothPrice).toBe('1500');
    });

    it('returns 404 for a missing booking or another vendor booking', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        service.cancel(BOOKING_ID, CANCEL_DTO, VENDOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bookingUpdateMany).not.toHaveBeenCalled();
    });

    it.each([
      BookingStatus.CANCELLED,
      BookingStatus.NO_SHOW,
      BookingStatus.COMPLETED,
    ])('rejects a booking in %s status', async (status) => {
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status,
        holdExpiresAt: null,
        bookingStartDate: EVENT_START,
      });

      await expect(
        service.cancel(BOOKING_ID, CANCEL_DTO, VENDOR_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(bookingUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects cancellation on or after the booking start date', async () => {
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status: BookingStatus.CONFIRMED,
        holdExpiresAt: null,
        bookingStartDate: NOW,
      });

      await expect(
        service.cancel(BOOKING_ID, CANCEL_DTO, VENDOR_ID),
      ).rejects.toThrow('ไม่สามารถยกเลิกหลังวันเริ่มจองได้');
      expect(bookingUpdateMany).not.toHaveBeenCalled();
    });

    it('records an expired pending hold as a system cancellation', async () => {
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: new Date('2026-08-01T23:59:59.000Z'),
        bookingStartDate: EVENT_START,
      });

      await expect(
        service.cancel(BOOKING_ID, CANCEL_DTO, VENDOR_ID),
      ).rejects.toThrow('การจองหมดเวลาชำระเงินแล้ว');
      expect(bookingUpdateMany).toHaveBeenCalledWith({
        where: {
          id: BOOKING_ID,
          vendorUserId: VENDOR_ID,
          status: BookingStatus.PENDING_PAYMENT,
          OR: [{ holdExpiresAt: null }, { holdExpiresAt: { lte: NOW } }],
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledByUserId: null,
          cancelledByRole: CancelledByRole.SYSTEM,
          cancelledAt: NOW,
        },
      });
    });

    it('uses the Thailand calendar date for the cancellation cutoff', async () => {
      jest.setSystemTime(new Date('2026-09-09T18:00:00.000Z'));
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status: BookingStatus.CONFIRMED,
        holdExpiresAt: null,
        bookingStartDate: EVENT_START,
      });

      await expect(
        service.cancel(BOOKING_ID, CANCEL_DTO, VENDOR_ID),
      ).rejects.toThrow('ไม่สามารถยกเลิกหลังวันเริ่มจองได้');
      expect(bookingUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects a cancellation race without overwriting the booking', async () => {
      bookingUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.cancel(BOOKING_ID, CANCEL_DTO, VENDOR_ID),
      ).rejects.toThrow('การจองหมดเวลาหรือสถานะเปลี่ยนไปแล้ว');
      expect(bookingFindUnique).not.toHaveBeenCalled();
    });
  });

  it('lists only bookings owned by the authenticated vendor', async () => {
    const listedBooking = {
      ...CREATED_BOOKING,
      event: {
        id: EVENT_ID,
        name: 'ตลาดนัดสร้างสรรค์',
        organization: { promptpayId: '0812345678' },
      },
      booth: {
        id: BOOTH_ID,
        code: 'A01',
        zone: {
          id: '88888888-8888-4888-8888-888888888888',
          code: 'A',
          name: 'อาหารและเครื่องดื่ม',
        },
      },
      shop: { id: SHOP_ID, name: 'ร้านของปอนด์' },
    };
    bookingFindMany.mockResolvedValue([listedBooking]);

    const result = await service.findAll(VENDOR_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.paymentQrDataUri).toMatch(/^data:image\/png;base64,/);
    expect(result[0]).toEqual({
      ...listedBooking,
      event: { id: EVENT_ID, name: 'ตลาดนัดสร้างสรรค์' },
      boothPrice: '1500',
      paymentQrDataUri: 'data:image/png;base64,cXI=',
    });
    expect(bookingFindMany).toHaveBeenCalledWith({
      where: { vendorUserId: VENDOR_ID },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            organization: { select: { promptpayId: true } },
          },
        },
        booth: {
          select: {
            id: true,
            code: true,
            zone: { select: { id: true, code: true, name: true } },
          },
        },
        shop: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(generatePromptPayPayload).toHaveBeenCalledWith('0812345678', {
      amount: 1500,
    });
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      'promptpay-payload',
      expect.objectContaining({ width: 320 }),
    );
  });

  it('returns a null payment QR when the organizer has no PromptPay ID', async () => {
    bookingFindMany.mockResolvedValue([
      {
        ...CREATED_BOOKING,
        event: {
          id: EVENT_ID,
          name: 'ตลาดนัดสร้างสรรค์',
          organization: { promptpayId: null },
        },
        booth: {
          id: BOOTH_ID,
          code: 'A01',
          zone: {
            id: '88888888-8888-4888-8888-888888888888',
            code: 'A',
            name: 'อาหารและเครื่องดื่ม',
          },
        },
        shop: { id: SHOP_ID, name: 'ร้านของปอนด์' },
      },
    ]);

    const [result] = await service.findAll(VENDOR_ID);

    expect(result.paymentQrDataUri).toBeNull();
  });

  it('lists organization bookings with admin display data and string money', async () => {
    bookingFindMany.mockResolvedValue([ADMIN_BOOKING]);

    await expect(service.findByOrganization(ORGANIZATION_ID)).resolves.toEqual([
      { ...ADMIN_BOOKING, boothPrice: '1500' },
    ]);

    expect(bookingFindMany).toHaveBeenCalledWith({
      where: { event: { organizationId: ORGANIZATION_ID } },
      include: ADMIN_BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('lists bookings across organizations without a tenant filter', async () => {
    bookingFindMany.mockResolvedValue([ADMIN_BOOKING]);

    await expect(service.findAllAcrossOrganizations()).resolves.toEqual([
      { ...ADMIN_BOOKING, boothPrice: '1500' },
    ]);

    expect(bookingFindMany).toHaveBeenCalledWith({
      include: ADMIN_BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  });

  describe('createAdminSlipAccess', () => {
    it('signs only the latest slip inside the guard-resolved organization', async () => {
      verifiedSlipFindFirst.mockResolvedValue({
        slipImageUrl: SLIP_OBJECT_PATH,
      });
      createAdminAccess.mockResolvedValue({
        viewUrl: SIGNED_SLIP_URL,
        downloadUrl: `${SIGNED_SLIP_URL}&download=payment-slip.jpg`,
        expiresInSeconds: 300,
      });

      const result = await service.createAdminSlipAccess(
        BOOKING_ID,
        ORGANIZATION_ID,
      );

      expect(verifiedSlipFindFirst).toHaveBeenCalledWith({
        where: {
          bookingId: BOOKING_ID,
          booking: { event: { organizationId: ORGANIZATION_ID } },
        },
        select: { slipImageUrl: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(createAdminAccess).toHaveBeenCalledWith(SLIP_OBJECT_PATH);
      expect(result.expiresInSeconds).toBe(300);
    });

    it('returns the same 404 for missing and out-of-organization slips', async () => {
      verifiedSlipFindFirst.mockResolvedValue(null);

      await expect(
        service.createAdminSlipAccess(BOOKING_ID, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(createAdminAccess).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('reads a booking filtered by the organization the guard resolved', async () => {
      bookingFindFirst.mockResolvedValue(CREATED_BOOKING);

      const result = await service.findOne(BOOKING_ID, ORGANIZATION_ID);

      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: {
          id: BOOKING_ID,
          event: { organizationId: ORGANIZATION_ID },
        },
      });
      expect(result.id).toBe(BOOKING_ID);
      // Money crosses the boundary as a string, never a Decimal or a float (§6.1).
      expect(result.boothPrice).toBe('1500');
    });

    it('returns 404 rather than null for a missing booking', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        service.findOne(BOOKING_ID, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findByCode', () => {
    const ORG_ADMIN = { id: ADMIN_ID, role: UserRole.ORG_ADMIN };
    const SUPER_ADMIN = { id: ADMIN_ID, role: UserRole.SUPER_ADMIN };

    it('filters an ORG_ADMIN lookup by their own memberships', async () => {
      bookingFindFirst.mockResolvedValue(CREATED_BOOKING);

      const result = await service.findByCode(BOOKING_CODE, ORG_ADMIN);

      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: {
          bookingCode: BOOKING_CODE,
          event: {
            organization: { memberships: { some: { userId: ADMIN_ID } } },
          },
        },
      });
      expect(result.bookingCode).toBe(BOOKING_CODE);
      expect(result.boothPrice).toBe('1500');
    });

    it('does not filter a SUPER_ADMIN lookup', async () => {
      bookingFindFirst.mockResolvedValue(CREATED_BOOKING);

      await service.findByCode(BOOKING_CODE, SUPER_ADMIN);

      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: { bookingCode: BOOKING_CODE },
      });
    });

    // A code in another organization and a code that does not exist are the same
    // 404 — the code is short and guessable, so the two must not be told apart.
    it('returns 404 for an unknown or out-of-organization code', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        service.findByCode(BOOKING_CODE, ORG_ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmExempt', () => {
    beforeEach(() => {
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status: BookingStatus.PENDING_PAYMENT,
        vendor: { isBlacklisted: false },
      });
      bookingFindUnique.mockResolvedValue({
        ...CREATED_BOOKING,
        status: BookingStatus.CONFIRMED,
        isPaymentExempt: true,
        paymentExemptReason: EXEMPT_DTO.paymentExemptReason,
        confirmedAt: NOW,
      });
    });

    it('confirms a pending booking as payment-exempt', async () => {
      const result = await service.confirmExempt(
        BOOKING_ID,
        EXEMPT_DTO,
        ORGANIZATION_ID,
      );

      expect(bookingFindFirst).toHaveBeenCalledWith({
        where: {
          id: BOOKING_ID,
          event: { organizationId: ORGANIZATION_ID },
        },
        select: {
          id: true,
          status: true,
          vendor: { select: { isBlacklisted: true } },
        },
      });
      // The status sits in the `where`, not only in the guard above it: the
      // hold-expiry cron can cancel this row between the read and the write.
      expect(bookingUpdateMany).toHaveBeenCalledWith({
        where: {
          id: BOOKING_ID,
          event: { organizationId: ORGANIZATION_ID },
          status: BookingStatus.PENDING_PAYMENT,
        },
        data: {
          isPaymentExempt: true,
          paymentExemptReason: EXEMPT_DTO.paymentExemptReason,
          status: BookingStatus.CONFIRMED,
          confirmedAt: NOW,
        },
      });
      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(result.isPaymentExempt).toBe(true);
      expect(result.paymentExemptReason).toBe(EXEMPT_DTO.paymentExemptReason);
      expect(result.boothPrice).toBe('1500');
      expect(createForUser).toHaveBeenCalledWith(VENDOR_ID, {
        type: NotificationType.BOOKING_STATUS,
        title: 'การจองของคุณได้รับการยืนยันแล้ว',
        body: 'แอดมินยืนยันการจองให้คุณโดยยกเว้นการชำระเงิน',
        relatedEntityType: 'BOOKING',
        relatedEntityId: BOOKING_ID,
      });
    });

    it('rejects a blacklisted vendor before updating the booking', async () => {
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status: BookingStatus.PENDING_PAYMENT,
        vendor: { isBlacklisted: true },
      });

      await expect(
        service.confirmExempt(BOOKING_ID, EXEMPT_DTO, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bookingUpdateMany).not.toHaveBeenCalled();
    });

    // The hold having lapsed is not a reason to refuse: rescuing a booking the
    // cron has not swept yet is what this method is for.
    it('confirms a pending booking whose hold has already expired', async () => {
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: new Date('2026-08-01T00:00:00.000Z'),
        vendor: { isBlacklisted: false },
      });

      await expect(
        service.confirmExempt(BOOKING_ID, EXEMPT_DTO, ORGANIZATION_ID),
      ).resolves.toMatchObject({ status: BookingStatus.CONFIRMED });
    });

    it('returns 404 for a missing or out-of-organization booking', async () => {
      bookingFindFirst.mockResolvedValue(null);

      await expect(
        service.confirmExempt(BOOKING_ID, EXEMPT_DTO, ORGANIZATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bookingUpdateMany).not.toHaveBeenCalled();
    });

    it.each([
      BookingStatus.CONFIRMED,
      BookingStatus.CANCELLED,
      BookingStatus.NO_SHOW,
      BookingStatus.COMPLETED,
    ])('rejects a booking in %s status', async (status) => {
      bookingFindFirst.mockResolvedValue({
        id: BOOKING_ID,
        status,
        vendor: { isBlacklisted: false },
      });

      await expect(
        service.confirmExempt(BOOKING_ID, EXEMPT_DTO, ORGANIZATION_ID),
      ).rejects.toThrow(
        'ยืนยันการจองนี้ไม่ได้ เนื่องจากไม่ได้อยู่ในสถานะรอชำระเงิน',
      );
      expect(bookingUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects a confirmation race without reading the booking back', async () => {
      bookingUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.confirmExempt(BOOKING_ID, EXEMPT_DTO, ORGANIZATION_ID),
      ).rejects.toThrow('การจองหมดเวลาหรือสถานะเปลี่ยนไปแล้ว');
      expect(bookingFindUnique).not.toHaveBeenCalled();
      expect(createForUser).not.toHaveBeenCalled();
    });
  });
});
