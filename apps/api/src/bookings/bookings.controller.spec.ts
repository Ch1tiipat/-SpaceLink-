import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import type { UploadedSlipFile } from './booking-slip-storage.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
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

const cancel = jest.fn();
const create = jest.fn();
const findAll = jest.fn();
const findOne = jest.fn();
const uploadSlip = jest.fn();
const mockBookingsService = { cancel, create, findAll, findOne, uploadSlip };

function controllerHandler(
  name: 'cancel' | 'create' | 'findAll' | 'findOne' | 'uploadSlip',
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
      providers: [{ provide: BookingsService, useValue: mockBookingsService }],
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

  it('allows vendors to create and list only while retaining admin findOne', () => {
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
    expect(
      Reflect.getMetadata(ROLES_KEY, controllerHandler('findOne')),
    ).toBeUndefined();
    expect(BookingsController.prototype).not.toHaveProperty('update');
    expect(BookingsController.prototype).not.toHaveProperty('remove');
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
});
