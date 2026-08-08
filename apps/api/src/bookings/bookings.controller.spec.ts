import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { UploadedSlipFile } from './booking-slip-storage.service';
import {
  BookingsController,
  PAYMENT_SLIP_UPLOAD_LIMITS,
} from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ConfirmExemptBookingDto } from './dto/confirm-exempt-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const VENDOR_ID = '11111111-1111-4111-8111-111111111111';
const CURRENT_USER: User = {
  id: VENDOR_ID,
  authUserId: '22222222-2222-4222-8222-222222222222',
  email: 'vendor@example.com',
  fullName: 'Vendor One',
  phone: null,
  role: UserRole.VENDOR,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};
const CREATE_DTO: CreateBookingDto = {
  eventId: '33333333-3333-4333-8333-333333333333',
  boothId: '44444444-4444-4444-8444-444444444444',
  shopId: '55555555-5555-4555-8555-555555555555',
};
const SLIP_FILE: UploadedSlipFile = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
};
const CANCEL_DTO: CancelBookingDto = {
  cancelReason: 'ไม่สามารถเข้าร่วมงานได้',
};
const ORGANIZATION_ID = '66666666-6666-4666-8666-666666666666';
const ADMIN_USER: User = {
  ...CURRENT_USER,
  id: '77777777-7777-4777-8777-777777777777',
  email: 'admin@example.com',
  fullName: 'Org Admin',
  role: UserRole.ORG_ADMIN,
};
const EXEMPT_DTO: ConfirmExemptBookingDto = {
  paymentExemptReason: 'ผู้ขายชำระเงินสดหน้างานแล้ว',
};

const cancel = jest.fn();
const confirmExempt = jest.fn();
const create = jest.fn();
const findAll = jest.fn();
const findByCode = jest.fn();
const findOne = jest.fn();
const uploadSlip = jest.fn();
const mockBookingsService = {
  cancel,
  confirmExempt,
  create,
  findAll,
  findByCode,
  findOne,
  uploadSlip,
};

function controllerHandler(
  name:
    | 'cancel'
    | 'confirmExempt'
    | 'create'
    | 'findAll'
    | 'findByCode'
    | 'findOne'
    | 'uploadSlip',
): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    BookingsController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`Missing controller handler: ${name}`);
  }
  return descriptor.value as object;
}

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        { provide: BookingsService, useValue: mockBookingsService },
        // OrgScopeGuard arrives on the two admin routes via @OrgScoped, and Nest
        // resolves it at compile time. It is never executed here — this suite
        // only inspects decorator metadata — so an empty stub is enough. The
        // guard's own behaviour is covered in org-scope.guard.spec.ts.
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('runs authentication before role authorization', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, BookingsController)).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
  });

  it('keeps vendor routes vendor-only and admin routes admin-only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, BookingsController)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, controllerHandler('create'))).toEqual(
      [UserRole.VENDOR],
    );
    expect(
      Reflect.getMetadata(ROLES_KEY, controllerHandler('findAll')),
    ).toEqual([UserRole.VENDOR]);
    expect(
      Reflect.getMetadata(ROLES_KEY, controllerHandler('uploadSlip')),
    ).toEqual([UserRole.VENDOR]);
    expect(Reflect.getMetadata(ROLES_KEY, controllerHandler('cancel'))).toEqual(
      [UserRole.VENDOR],
    );
    // The three admin routes. SUPER_ADMIN is listed explicitly on the
    // org-scoped ones because OrgScopeGuard bypasses the membership check for
    // that role — omitting it here would let a super admin pass OrgScopeGuard
    // and then be rejected by RolesGuard.
    for (const name of ['findOne', 'confirmExempt', 'findByCode'] as const) {
      expect(Reflect.getMetadata(ROLES_KEY, controllerHandler(name))).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
      ]);
    }
    expect(BookingsController.prototype).not.toHaveProperty('update');
    expect(BookingsController.prototype).not.toHaveProperty('remove');
  });

  // Metadata alone enforces nothing, so assert the guard travels with it: both
  // come from @OrgScoped, and a route carrying only the metadata would return
  // 200 while checking no tenant at all.
  it.each(['findOne', 'confirmExempt'] as const)(
    'puts %s behind OrgScopeGuard scoped to bookingId',
    (name) => {
      const handler = controllerHandler(name);

      expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('bookingId');
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
      ]);
    },
  );

  // findByCode is the deliberate exception: OrgScopeGuard rejects a non-UUID
  // route param, so its ownership check lives in the service instead. It must
  // not carry the metadata either, or the guard would 400 every valid code.
  it('leaves findByCode unscoped at the route, checked in the service', () => {
    const handler = controllerHandler('findByCode');

    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
  });

  it('passes the authenticated vendor id when creating a booking', async () => {
    create.mockResolvedValue({ id: 'booking-1' });

    await controller.create(CREATE_DTO, CURRENT_USER);

    expect(create).toHaveBeenCalledWith(CREATE_DTO, VENDOR_ID);
  });

  it('passes the authenticated vendor id when listing bookings', async () => {
    findAll.mockResolvedValue([]);

    await controller.findAll(CURRENT_USER);

    expect(findAll).toHaveBeenCalledWith(VENDOR_ID);
  });

  it('passes the cancellation reason and authenticated vendor id', async () => {
    cancel.mockResolvedValue({ id: 'booking-id' });

    await controller.cancel('booking-id', CANCEL_DTO, CURRENT_USER);

    expect(cancel).toHaveBeenCalledWith('booking-id', CANCEL_DTO, VENDOR_ID);
  });

  it('passes the uploaded file and authenticated vendor id to the service', async () => {
    uploadSlip.mockResolvedValue({});

    await controller.uploadSlip('booking-id', SLIP_FILE, CURRENT_USER);

    expect(uploadSlip).toHaveBeenCalledWith('booking-id', SLIP_FILE, VENDOR_ID);
  });

  it('rejects a request with no file', () => {
    expect(() =>
      controller.uploadSlip('booking-id', undefined, CURRENT_USER),
    ).toThrow(BadRequestException);
    expect(uploadSlip).not.toHaveBeenCalled();
  });

  it('passes the guard-resolved organization id when looking a booking up', async () => {
    findOne.mockResolvedValue({ id: 'booking-id' });

    await controller.findOne('booking-id', ORGANIZATION_ID);

    expect(findOne).toHaveBeenCalledWith('booking-id', ORGANIZATION_ID);
  });

  it('passes the exemption reason and guard-resolved organization id', async () => {
    confirmExempt.mockResolvedValue({ id: 'booking-id' });

    await controller.confirmExempt('booking-id', EXEMPT_DTO, ORGANIZATION_ID);

    expect(confirmExempt).toHaveBeenCalledWith(
      'booking-id',
      EXEMPT_DTO,
      ORGANIZATION_ID,
    );
  });

  // The whole user, not just the id: the service branches on `role` to decide
  // whether a membership filter applies at all.
  it('passes the authenticated admin when looking a booking up by code', async () => {
    findByCode.mockResolvedValue({ id: 'booking-id' });

    await controller.findByCode('BK-0123456789AB', ADMIN_USER);

    expect(findByCode).toHaveBeenCalledWith('BK-0123456789AB', ADMIN_USER);
  });

  it('limits the slip request to one file part and no text fields', () => {
    expect(PAYMENT_SLIP_UPLOAD_LIMITS).toEqual({
      files: 1,
      fields: 0,
      parts: 1,
      fileSize: 5 * 1024 * 1024,
    });
  });
});
