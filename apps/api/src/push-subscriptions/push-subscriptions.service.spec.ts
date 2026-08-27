import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PushSubscriptionsService } from './push-subscriptions.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ENDPOINT = 'https://push.example.com/subscription/one';
const INPUT = {
  endpoint: ENDPOINT,
  expirationTime: null,
  keys: { p256dh: 'new-p256dh', auth: 'new-auth' },
};

const upsert = jest.fn();
const deleteMany = jest.fn();
const mockPrismaService = {
  pushSubscription: { upsert, deleteMany },
};

describe('PushSubscriptionsService', () => {
  let service: PushSubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    upsert.mockResolvedValue({ id: 'subscription-id', endpoint: ENDPOINT });
    deleteMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushSubscriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    service = module.get(PushSubscriptionsService);
  });

  it('moves a duplicate endpoint to the authenticated user on upsert', async () => {
    await service.upsert(USER_ID, INPUT, 'Test Browser');

    expect(upsert).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT },
      create: {
        endpoint: ENDPOINT,
        userId: USER_ID,
        p256dhKey: 'new-p256dh',
        authKey: 'new-auth',
        userAgent: 'Test Browser',
      },
      update: {
        userId: USER_ID,
        p256dhKey: 'new-p256dh',
        authKey: 'new-auth',
        userAgent: 'Test Browser',
      },
      select: {
        id: true,
        endpoint: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
  });

  it('deletes only an endpoint owned by the authenticated user', async () => {
    await expect(service.delete(USER_ID, ENDPOINT)).resolves.toEqual({
      count: 1,
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT, userId: USER_ID },
    });
  });
});
