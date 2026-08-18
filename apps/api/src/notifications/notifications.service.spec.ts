import { Logger, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  NotificationType,
  type Notification,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ORGANIZATION_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ORGANIZATION_ID = '44444444-4444-4444-8444-444444444444';
const NOTIFICATION_ID = '55555555-5555-4555-8555-555555555555';
const CREATED_AT = new Date('2026-08-18T00:00:00.000Z');

const INPUT = {
  type: NotificationType.ANNOUNCEMENT,
  title: 'แจ้งเปลี่ยนเวลาเปิดงาน',
  body: 'งานจะเปิดเวลา 10.00 น.',
  relatedEntityType: 'ANNOUNCEMENT',
  relatedEntityId: '66666666-6666-4666-8666-666666666666',
};
const NOTIFICATION: Notification = {
  id: NOTIFICATION_ID,
  userId: USER_ID,
  ...INPUT,
  body: INPUT.body,
  relatedEntityType: INPUT.relatedEntityType,
  relatedEntityId: INPUT.relatedEntityId,
  isRead: false,
  createdAt: CREATED_AT,
};

const bookingFindMany = jest.fn();
const notificationCreate = jest.fn();
const notificationCreateMany = jest.fn();
const notificationFindMany = jest.fn();
const notificationCount = jest.fn();
const notificationUpdateMany = jest.fn();
const mockPrismaService = {
  booking: { findMany: bookingFindMany },
  notification: {
    create: notificationCreate,
    createMany: notificationCreateMany,
    findMany: notificationFindMany,
    count: notificationCount,
    updateMany: notificationUpdateMany,
  },
};

type BookingFixture = {
  vendorUserId: string;
  status: BookingStatus;
  event: { organizationId: string; endDate: Date };
};

type BookingFindManyArgs = {
  where: {
    status: { not: BookingStatus };
    event: { organizationId: string; endDate: { gte: Date } };
  };
  select: { vendorUserId: boolean };
  distinct: string[];
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-18T17:30:00.000Z'));
    jest.clearAllMocks();

    notificationCreate.mockResolvedValue(NOTIFICATION);
    notificationCreateMany.mockResolvedValue({ count: 2 });
    notificationFindMany.mockResolvedValue([NOTIFICATION]);
    notificationCount.mockResolvedValue(1);
    notificationUpdateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates one notification for the requested user', async () => {
    await expect(service.createForUser(USER_ID, INPUT)).resolves.toEqual(
      NOTIFICATION,
    );
    expect(notificationCreate).toHaveBeenCalledWith({
      data: { userId: USER_ID, ...INPUT },
    });
  });

  it('logs and resolves null when a notification cannot be created', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    notificationCreate.mockRejectedValue(new Error('database unavailable'));

    await expect(service.createForUser(USER_ID, INPUT)).resolves.toBeNull();
    expect(error).toHaveBeenCalledWith(
      'Failed to create an in-app notification',
    );

    error.mockRestore();
  });

  it('fans out to distinct active bookers using the Bangkok calendar date', async () => {
    const fixtures: BookingFixture[] = [
      {
        vendorUserId: USER_ID,
        status: BookingStatus.CONFIRMED,
        event: {
          organizationId: ORGANIZATION_ID,
          endDate: new Date('2026-08-19T00:00:00.000Z'),
        },
      },
      {
        vendorUserId: USER_ID,
        status: BookingStatus.PENDING_PAYMENT,
        event: {
          organizationId: ORGANIZATION_ID,
          endDate: new Date('2026-08-20T00:00:00.000Z'),
        },
      },
      {
        vendorUserId: OTHER_USER_ID,
        status: BookingStatus.CONFIRMED,
        event: {
          organizationId: ORGANIZATION_ID,
          endDate: new Date('2026-08-21T00:00:00.000Z'),
        },
      },
      {
        vendorUserId: '77777777-7777-4777-8777-777777777777',
        status: BookingStatus.CONFIRMED,
        event: {
          organizationId: ORGANIZATION_ID,
          // At 00:30 on 19 August in Thailand, the 18th has ended.
          endDate: new Date('2026-08-18T00:00:00.000Z'),
        },
      },
      {
        vendorUserId: '88888888-8888-4888-8888-888888888888',
        status: BookingStatus.CANCELLED,
        event: {
          organizationId: ORGANIZATION_ID,
          endDate: new Date('2026-08-20T00:00:00.000Z'),
        },
      },
      {
        vendorUserId: '99999999-9999-4999-8999-999999999999',
        status: BookingStatus.CONFIRMED,
        event: {
          organizationId: OTHER_ORGANIZATION_ID,
          endDate: new Date('2026-08-20T00:00:00.000Z'),
        },
      },
    ];
    bookingFindMany.mockImplementation((args: BookingFindManyArgs) => {
      const seen = new Set<string>();
      return Promise.resolve(
        fixtures
          .filter(
            ({ status, event }) =>
              status !== args.where.status.not &&
              event.organizationId === args.where.event.organizationId &&
              event.endDate >= args.where.event.endDate.gte,
          )
          .filter(({ vendorUserId }) => {
            if (seen.has(vendorUserId)) return false;
            seen.add(vendorUserId);
            return true;
          })
          .map(({ vendorUserId }) => ({ vendorUserId })),
      );
    });

    await expect(
      service.fanOutToOrganizationBookers(ORGANIZATION_ID, INPUT),
    ).resolves.toBe(2);
    expect(bookingFindMany).toHaveBeenCalledWith({
      where: {
        status: { not: BookingStatus.CANCELLED },
        event: {
          organizationId: ORGANIZATION_ID,
          endDate: { gte: new Date('2026-08-19T00:00:00.000Z') },
        },
      },
      select: { vendorUserId: true },
      distinct: ['vendorUserId'],
    });
    expect(notificationCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: USER_ID, ...INPUT },
        { userId: OTHER_USER_ID, ...INPUT },
      ],
    });
  });

  it('logs and returns zero when fan-out fails', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    bookingFindMany.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.fanOutToOrganizationBookers(ORGANIZATION_ID, INPUT),
    ).resolves.toBe(0);
    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Failed to fan out an announcement notification',
    );

    error.mockRestore();
  });

  it('lists the latest one hundred notifications for the caller', async () => {
    await expect(service.findMine(USER_ID)).resolves.toEqual([NOTIFICATION]);
    expect(notificationFindMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('can limit the caller list to unread notifications', async () => {
    await service.findMine(USER_ID, true);
    expect(notificationFindMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('counts only the caller unread notifications', async () => {
    await expect(service.unreadCount(USER_ID)).resolves.toEqual({ count: 1 });
    expect(notificationCount).toHaveBeenCalledWith({
      where: { userId: USER_ID, isRead: false },
    });
  });

  it('marks one caller-owned notification as read', async () => {
    await expect(service.markRead(USER_ID, NOTIFICATION_ID)).resolves.toEqual({
      count: 1,
    });
    expect(notificationUpdateMany).toHaveBeenCalledWith({
      where: { id: NOTIFICATION_ID, userId: USER_ID },
      data: { isRead: true },
    });
  });

  it('returns 404 without revealing a foreign notification', async () => {
    notificationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.markRead(USER_ID, NOTIFICATION_ID)).rejects.toEqual(
      new NotFoundException('ไม่พบการแจ้งเตือน'),
    );
  });

  it('marks every unread notification for the caller as read', async () => {
    await expect(service.markAllRead(USER_ID)).resolves.toEqual({ count: 1 });
    expect(notificationUpdateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, isRead: false },
      data: { isRead: true },
    });
  });
});
