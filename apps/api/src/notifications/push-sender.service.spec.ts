import { Logger } from '@nestjs/common';
import type { PushSubscription } from '@prisma/client';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushSenderService } from './push-sender.service';

jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  },
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBSCRIPTION: PushSubscription = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: USER_ID,
  endpoint: 'https://push.example.com/subscription/one',
  p256dhKey: 'p256dh-key',
  authKey: 'auth-key',
  userAgent: 'Test Browser',
  createdAt: new Date('2026-08-28T00:00:00.000Z'),
  lastUsedAt: null,
};
const PAYLOAD = { title: 'แจ้งเตือน', body: 'รายละเอียด' };

const findMany = jest.fn();
const deleteMany = jest.fn();
const prisma = {
  pushSubscription: { findMany, deleteMany },
} as unknown as PrismaService;

describe('PushSenderService', () => {
  const originalVapidSubject = process.env.VAPID_SUBJECT;
  const originalVapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const originalVapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_SUBJECT = 'mailto:admin@example.com';
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    findMany.mockResolvedValue([SUBSCRIPTION]);
    deleteMany.mockResolvedValue({ count: 1 });
    jest.mocked(webpush.sendNotification).mockResolvedValue({} as never);
  });

  afterAll(() => {
    restoreEnv('VAPID_SUBJECT', originalVapidSubject);
    restoreEnv('VAPID_PUBLIC_KEY', originalVapidPublicKey);
    restoreEnv('VAPID_PRIVATE_KEY', originalVapidPrivateKey);
  });

  it('stays disabled and does not query subscriptions without a private key', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const service = new PushSenderService(prisma);

    await expect(service.sendToUser(USER_ID, PAYLOAD)).resolves.toBeUndefined();

    expect(findMany).not.toHaveBeenCalled();
    expect(webpush.setVapidDetails).not.toHaveBeenCalled();
  });

  it('sends the browser-native subscription shape', async () => {
    const service = new PushSenderService(prisma);

    await service.sendToUser(USER_ID, PAYLOAD);

    expect(findMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: SUBSCRIPTION.endpoint,
        keys: { p256dh: SUBSCRIPTION.p256dhKey, auth: SUBSCRIPTION.authKey },
      },
      JSON.stringify(PAYLOAD),
    );
  });

  it('removes a subscription when the push service returns 410', async () => {
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValue({ statusCode: 410 });
    const service = new PushSenderService(prisma);

    await expect(service.sendToUser(USER_ID, PAYLOAD)).resolves.toBeUndefined();

    expect(deleteMany).toHaveBeenCalledWith({
      where: { endpoint: SUBSCRIPTION.endpoint },
    });
  });

  it('swallows non-terminal push errors without deleting the subscription', async () => {
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValue(new Error('push unavailable'));
    const service = new PushSenderService(prisma);

    await expect(service.sendToUser(USER_ID, PAYLOAD)).resolves.toBeUndefined();

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('swallows subscription query failures', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    findMany.mockRejectedValue(new Error('database unavailable'));
    const service = new PushSenderService(prisma);

    await expect(service.sendToUser(USER_ID, PAYLOAD)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('Failed to send web push notifications');
    error.mockRestore();
  });

  it('settles every user send even if one send rejects unexpectedly', async () => {
    const service = new PushSenderService(prisma);
    const sendToUser = jest
      .spyOn(service, 'sendToUser')
      .mockRejectedValueOnce(new Error('unexpected'))
      .mockResolvedValue(undefined);

    await expect(
      service.sendToUsers(
        [USER_ID, '33333333-3333-4333-8333-333333333333'],
        PAYLOAD,
      ),
    ).resolves.toBeUndefined();

    expect(sendToUser).toHaveBeenCalledTimes(2);
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
