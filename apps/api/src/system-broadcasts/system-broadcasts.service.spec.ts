import { Test, type TestingModule } from '@nestjs/testing';
import type { SystemBroadcast } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemBroadcastsService } from './system-broadcasts.service';

const CREATOR_ID = '11111111-1111-4111-8111-111111111111';
const BROADCAST_ID = '22222222-2222-4222-8222-222222222222';
const CREATED_AT = new Date('2026-08-28T01:00:00.000Z');
const FUTURE_EXPIRY = new Date('2026-08-29T01:00:00.000Z');
const INPUT = {
  title: 'ปิดปรับปรุงระบบ',
  body: 'ระบบจะปิดปรับปรุงเวลา 02.00 น.',
  expiresAt: FUTURE_EXPIRY.toISOString(),
};
const BROADCAST: SystemBroadcast = {
  id: BROADCAST_ID,
  title: INPUT.title,
  body: INPUT.body,
  createdBy: CREATOR_ID,
  createdAt: CREATED_AT,
  expiresAt: FUTURE_EXPIRY,
};

const systemBroadcastCreate = jest.fn();
const systemBroadcastFindFirst = jest.fn();
const broadcastToAllUsers = jest.fn();
const mockPrismaService = {
  systemBroadcast: {
    create: systemBroadcastCreate,
    findFirst: systemBroadcastFindFirst,
  },
};
const mockNotificationsService = { broadcastToAllUsers };

describe('SystemBroadcastsService', () => {
  let service: SystemBroadcastsService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-28T02:00:00.000Z'));
    jest.clearAllMocks();
    systemBroadcastCreate.mockResolvedValue(BROADCAST);
    broadcastToAllUsers.mockResolvedValue(2);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemBroadcastsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get(SystemBroadcastsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves the broadcast before starting notification fan-out', async () => {
    await expect(service.create(CREATOR_ID, INPUT)).resolves.toEqual(BROADCAST);
    expect(systemBroadcastCreate).toHaveBeenCalledWith({
      data: {
        title: INPUT.title,
        body: INPUT.body,
        createdBy: CREATOR_ID,
        expiresAt: FUTURE_EXPIRY,
      },
    });
    expect(broadcastToAllUsers).toHaveBeenCalledWith({
      title: INPUT.title,
      body: INPUT.body,
    });
    expect(systemBroadcastCreate.mock.invocationCallOrder[0]).toBeLessThan(
      broadcastToAllUsers.mock.invocationCallOrder[0],
    );
  });

  it('stores null when an expiry is not supplied', async () => {
    await service.create(CREATOR_ID, {
      title: INPUT.title,
      body: INPUT.body,
    });
    expect(systemBroadcastCreate).toHaveBeenCalledWith({
      data: {
        title: INPUT.title,
        body: INPUT.body,
        createdBy: CREATOR_ID,
        expiresAt: null,
      },
    });
  });

  it('returns the saved broadcast when fan-out rejects', async () => {
    broadcastToAllUsers.mockRejectedValue(new Error('fan-out unavailable'));

    await expect(service.create(CREATOR_ID, INPUT)).resolves.toEqual(BROADCAST);
  });

  it('returns the latest unexpired broadcast without prefiltering older rows', async () => {
    systemBroadcastFindFirst.mockResolvedValue(BROADCAST);

    await expect(service.findActive()).resolves.toEqual(BROADCAST);
    expect(systemBroadcastFindFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns a latest broadcast without an expiry', async () => {
    const indefinite = { ...BROADCAST, expiresAt: null };
    systemBroadcastFindFirst.mockResolvedValue(indefinite);

    await expect(service.findActive()).resolves.toEqual(indefinite);
  });

  it('returns null when the latest broadcast has expired', async () => {
    systemBroadcastFindFirst.mockResolvedValue({
      ...BROADCAST,
      expiresAt: new Date('2026-08-28T01:59:59.000Z'),
    });

    await expect(service.findActive()).resolves.toBeNull();
    expect(systemBroadcastFindFirst).toHaveBeenCalledTimes(1);
  });

  it('treats an expiry equal to the current time as expired', async () => {
    systemBroadcastFindFirst.mockResolvedValue({
      ...BROADCAST,
      expiresAt: new Date('2026-08-28T02:00:00.000Z'),
    });

    await expect(service.findActive()).resolves.toBeNull();
  });

  it('returns null when no broadcast exists', async () => {
    systemBroadcastFindFirst.mockResolvedValue(null);

    await expect(service.findActive()).resolves.toBeNull();
  });
});
