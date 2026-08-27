import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, type TestingModule } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { CreateSystemBroadcastDto } from './dto/create-system-broadcast.dto';
import { SystemBroadcastsController } from './system-broadcasts.controller';
import { SystemBroadcastsService } from './system-broadcasts.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));
jest.mock('../auth/guards/roles.guard', () => ({
  RolesGuard: class RolesGuard {},
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CURRENT_USER: User = {
  id: USER_ID,
  authUserId: '22222222-2222-4222-8222-222222222222',
  email: 'admin@example.com',
  fullName: 'Super Admin',
  phone: null,
  role: UserRole.SUPER_ADMIN,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-28T00:00:00.000Z'),
  updatedAt: new Date('2026-08-28T00:00:00.000Z'),
};
const INPUT = {
  title: 'ปิดปรับปรุงระบบ',
  body: 'ระบบจะปิดปรับปรุงเวลา 02.00 น.',
  expiresAt: '2026-08-29T02:00:00.000Z',
};

const create = jest.fn();
const findActive = jest.fn();
const mockService = { create, findActive };

describe('SystemBroadcastsController', () => {
  let controller: SystemBroadcastsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemBroadcastsController],
      providers: [{ provide: SystemBroadcastsService, useValue: mockService }],
    }).compile();
    controller = module.get(SystemBroadcastsController);
  });

  it('runs Supabase authentication before role authorization', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SystemBroadcastsController),
    ).toEqual([SupabaseAuthGuard, RolesGuard]);
  });

  it('limits creation to SUPER_ADMIN', () => {
    const createHandler = Object.getOwnPropertyDescriptor(
      SystemBroadcastsController.prototype,
      'create',
    )?.value as object;
    expect(Reflect.getMetadata(ROLES_KEY, createHandler)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
  });

  it('allows every authenticated role to read the active broadcast', () => {
    const findActiveHandler = Object.getOwnPropertyDescriptor(
      SystemBroadcastsController.prototype,
      'findActive',
    )?.value as object;
    expect(Reflect.getMetadata(ROLES_KEY, findActiveHandler)).toBeUndefined();
  });

  it('derives the creator from the authenticated database user', async () => {
    await controller.create(CURRENT_USER, INPUT);
    expect(create).toHaveBeenCalledWith(USER_ID, INPUT);
  });

  it('delegates the active lookup', async () => {
    await controller.findActive();
    expect(findActive).toHaveBeenCalledTimes(1);
  });

  it('validates title, body, and an optional ISO expiry', async () => {
    const valid = plainToInstance(CreateSystemBroadcastDto, INPUT);
    const withoutExpiry = plainToInstance(CreateSystemBroadcastDto, {
      title: INPUT.title,
      body: INPUT.body,
    });
    const invalid = plainToInstance(CreateSystemBroadcastDto, {
      title: '',
      body: '',
      expiresAt: 'tomorrow',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(withoutExpiry)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
