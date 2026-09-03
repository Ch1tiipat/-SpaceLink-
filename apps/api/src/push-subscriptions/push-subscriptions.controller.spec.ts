import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, type TestingModule } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { PushSubscriptionsController } from './push-subscriptions.controller';
import { PushSubscriptionsService } from './push-subscriptions.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CURRENT_USER: User = {
  id: USER_ID,
  authUserId: '22222222-2222-4222-8222-222222222222',
  email: 'vendor@example.com',
  fullName: 'Vendor One',
  phone: null,
  role: UserRole.VENDOR,
  trustScore: 100,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-28T00:00:00.000Z'),
  updatedAt: new Date('2026-08-28T00:00:00.000Z'),
};
const ENDPOINT = 'https://push.example.com/subscription/one';
const INPUT = {
  endpoint: ENDPOINT,
  expirationTime: null,
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

const upsert = jest.fn();
const deleteSubscription = jest.fn();
const mockService = { upsert, delete: deleteSubscription };

describe('PushSubscriptionsController', () => {
  let controller: PushSubscriptionsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushSubscriptionsController],
      providers: [{ provide: PushSubscriptionsService, useValue: mockService }],
    }).compile();
    controller = module.get(PushSubscriptionsController);
  });

  it('uses only Supabase authentication at controller level', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PushSubscriptionsController),
    ).toEqual([SupabaseAuthGuard]);
  });

  it('derives ownership from the authenticated user and reads User-Agent', async () => {
    await controller.create(CURRENT_USER, INPUT, 'Test Browser');
    expect(upsert).toHaveBeenCalledWith(USER_ID, INPUT, 'Test Browser');
  });

  it('passes user ownership when deleting an endpoint', async () => {
    await controller.delete(CURRENT_USER, { endpoint: ENDPOINT });
    expect(deleteSubscription).toHaveBeenCalledWith(USER_ID, ENDPOINT);
  });

  it('validates the browser-native nested keys payload', async () => {
    const dto = plainToInstance(CreatePushSubscriptionDto, INPUT);
    const invalid = plainToInstance(CreatePushSubscriptionDto, {
      endpoint: ENDPOINT,
      keys: { p256dh: 'p256dh-key' },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
