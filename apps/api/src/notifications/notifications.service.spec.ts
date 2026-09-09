import { Logger, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  MembershipRole,
  NotificationType,
  Prisma,
  ReviewTargetType,
  UserRole,
  type Notification,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { PushSenderService } from './push-sender.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ORGANIZATION_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ORGANIZATION_ID = '44444444-4444-4444-8444-444444444444';
const NOTIFICATION_ID = '55555555-5555-4555-8555-555555555555';
const REVIEW_BOOKING_ID = '66666666-6666-4666-8666-666666666666';
const OLDER_REVIEW_BOOKING_ID = '77777777-7777-4777-8777-777777777777';
const REVIEW_BOOTH_ID = '88888888-8888-4888-8888-888888888888';
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
const reviewFindMany = jest.fn();
const userFindMany = jest.fn();
const orgMembershipFindMany = jest.fn();
const notificationCreate = jest.fn();
const notificationCreateMany = jest.fn();
const notificationFindMany = jest.fn();
const notificationCount = jest.fn();
const notificationUpdateMany = jest.fn();
const sendToUser = jest.fn();
const sendToUsers = jest.fn();
const prismaTransaction = jest.fn();
const transactionClient = {
  booking: { findMany: bookingFindMany },
  review: { findMany: reviewFindMany },
  notification: {
    findMany: notificationFindMany,
    createMany: notificationCreateMany,
  },
};
const mockPrismaService = {
  booking: { findMany: bookingFindMany },
  review: { findMany: reviewFindMany },
  user: { findMany: userFindMany },
  orgMembership: { findMany: orgMembershipFindMany },
  notification: {
    create: notificationCreate,
    createMany: notificationCreateMany,
    findMany: notificationFindMany,
    count: notificationCount,
    updateMany: notificationUpdateMany,
  },
  $transaction: prismaTransaction,
};
const mockPushSenderService = { sendToUser, sendToUsers };

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
    sendToUser.mockResolvedValue(undefined);
    sendToUsers.mockResolvedValue(undefined);
    userFindMany.mockResolvedValue([{ id: USER_ID }, { id: OTHER_USER_ID }]);
    orgMembershipFindMany.mockResolvedValue([
      { userId: USER_ID },
      { userId: OTHER_USER_ID },
    ]);
    reviewFindMany.mockResolvedValue([]);
    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(transactionClient as unknown as Prisma.TransactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PushSenderService, useValue: mockPushSenderService },
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
    expect(sendToUser).toHaveBeenCalledWith(USER_ID, {
      title: INPUT.title,
      body: INPUT.body,
    });
  });

  it('keeps the saved notification result when web push fails', async () => {
    sendToUser.mockRejectedValue(new Error('push unavailable'));

    await expect(service.createForUser(USER_ID, INPUT)).resolves.toEqual(
      NOTIFICATION,
    );
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
    expect(sendToUser).not.toHaveBeenCalled();

    error.mockRestore();
  });

  it('fans out an actionable notification to every user with the requested role', async () => {
    await expect(
      service.createForRole(UserRole.SUPER_ADMIN, INPUT),
    ).resolves.toBe(2);

    expect(userFindMany).toHaveBeenCalledWith({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true },
    });
    expect(notificationCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: USER_ID, ...INPUT },
        { userId: OTHER_USER_ID, ...INPUT },
      ],
    });
    expect(sendToUsers).toHaveBeenCalledWith([USER_ID, OTHER_USER_ID], {
      title: INPUT.title,
      body: INPUT.body,
    });
  });

  it('does not write role notifications when no matching user exists', async () => {
    userFindMany.mockResolvedValue([]);

    await expect(
      service.createForRole(UserRole.SUPER_ADMIN, INPUT),
    ).resolves.toBe(0);
    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('keeps role notification fan-out best-effort', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    notificationCreateMany.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.createForRole(UserRole.SUPER_ADMIN, INPUT),
    ).resolves.toBe(0);
    expect(sendToUsers).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Failed to create role-based notifications',
    );

    error.mockRestore();
  });

  it('routes payment work only to delegated admins in the requested organization', async () => {
    await expect(
      service.createForOrganizationAdmins(ORGANIZATION_ID, 'payments', INPUT),
    ).resolves.toBe(2);

    expect(orgMembershipFindMany).toHaveBeenCalledTimes(1);
    expect(orgMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORGANIZATION_ID,
        role: MembershipRole.ADMIN,
        canManagePayments: true,
        user: { role: UserRole.ORG_ADMIN },
      },
      select: { userId: true },
    });
    expect(notificationCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: USER_ID, ...INPUT },
        { userId: OTHER_USER_ID, ...INPUT },
      ],
    });
    expect(sendToUsers).toHaveBeenCalledWith([USER_ID, OTHER_USER_ID], {
      title: INPUT.title,
      body: INPUT.body,
    });
  });

  it('falls back to the organization owner when no zone admin is delegated', async () => {
    orgMembershipFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: USER_ID }]);
    notificationCreateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.createForOrganizationAdmins(ORGANIZATION_ID, 'zones', INPUT),
    ).resolves.toBe(1);

    expect(orgMembershipFindMany).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: ORGANIZATION_ID,
        role: MembershipRole.ADMIN,
        canManageZones: true,
        user: { role: UserRole.ORG_ADMIN },
      },
      select: { userId: true },
    });
    expect(orgMembershipFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: ORGANIZATION_ID,
        role: MembershipRole.OWNER,
        user: { role: UserRole.ORG_ADMIN },
      },
      select: { userId: true },
    });
    expect(notificationCreateMany).toHaveBeenCalledWith({
      data: [{ userId: USER_ID, ...INPUT }],
    });
  });

  it('keeps organization notification routing best-effort', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    orgMembershipFindMany.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.createForOrganizationAdmins(ORGANIZATION_ID, 'payments', INPUT),
    ).resolves.toBe(0);
    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(sendToUsers).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Failed to create organization admin notifications',
    );

    error.mockRestore();
  });

  it('creates an in-app invitation for the booking owner when review eligibility begins', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: REVIEW_BOOKING_ID,
        vendorUserId: USER_ID,
        boothId: REVIEW_BOOTH_ID,
        event: { name: 'งานเกษตร มทส. 2569' },
        booth: { code: 'A05' },
      },
    ]);
    reviewFindMany.mockResolvedValue([]);
    notificationFindMany.mockResolvedValue([]);
    notificationCreateMany.mockResolvedValue({ count: 1 });

    await expect(service.createReviewEligibilityNotifications()).resolves.toBe(
      1,
    );

    expect(bookingFindMany).toHaveBeenCalledWith({
      where: {
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
        },
        bookingEndDate: { lte: new Date('2026-08-18T00:30:00.000Z') },
      },
      select: {
        id: true,
        vendorUserId: true,
        boothId: true,
        event: { select: { name: true } },
        booth: { select: { code: true } },
      },
      orderBy: [{ bookingEndDate: 'desc' }, { createdAt: 'desc' }],
    });
    expect(reviewFindMany).toHaveBeenCalledWith({
      where: {
        reviewerUserId: { in: [USER_ID] },
        targetType: ReviewTargetType.BOOTH,
        targetId: { in: [REVIEW_BOOTH_ID] },
      },
      select: { reviewerUserId: true, targetId: true },
    });
    expect(notificationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          userId: USER_ID,
          type: NotificationType.SYSTEM,
          title: 'ถึงเวลารีวิวพื้นที่แล้ว',
          body: 'งานเกษตร มทส. 2569 · บูธ A05 พร้อมให้คุณแบ่งปันประสบการณ์แล้ว',
          relatedEntityType: 'BOOKING_REVIEW',
          relatedEntityId: REVIEW_BOOKING_ID,
        },
      ],
    });
  });

  it('does not invite a vendor who already reviewed the booth', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: REVIEW_BOOKING_ID,
        vendorUserId: USER_ID,
        boothId: REVIEW_BOOTH_ID,
        event: { name: 'งานเกษตร มทส. 2569' },
        booth: { code: 'A05' },
      },
    ]);
    reviewFindMany.mockResolvedValue([
      { reviewerUserId: USER_ID, targetId: REVIEW_BOOTH_ID },
    ]);
    notificationFindMany.mockResolvedValue([]);

    await expect(service.createReviewEligibilityNotifications()).resolves.toBe(
      0,
    );
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  it('deduplicates retries by the real user-and-booth review unit', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: REVIEW_BOOKING_ID,
        vendorUserId: USER_ID,
        boothId: REVIEW_BOOTH_ID,
        event: { name: 'งานใหม่' },
        booth: { code: 'A05' },
      },
      {
        id: OLDER_REVIEW_BOOKING_ID,
        vendorUserId: USER_ID,
        boothId: REVIEW_BOOTH_ID,
        event: { name: 'งานเดิม' },
        booth: { code: 'A05' },
      },
    ]);
    reviewFindMany.mockResolvedValue([]);
    notificationFindMany.mockResolvedValue([
      { userId: USER_ID, relatedEntityId: OLDER_REVIEW_BOOKING_ID },
    ]);

    await expect(service.createReviewEligibilityNotifications()).resolves.toBe(
      0,
    );
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });

  it('retries a serializable review-notification transaction conflict', async () => {
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction write conflict',
      { code: 'P2034', clientVersion: 'test' },
    );
    bookingFindMany.mockResolvedValue([]);
    prismaTransaction
      .mockRejectedValueOnce(serializationError)
      .mockImplementationOnce(
        (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          operation(transactionClient as unknown as Prisma.TransactionClient),
      );

    await expect(service.createReviewEligibilityNotifications()).resolves.toBe(
      0,
    );
    expect(prismaTransaction).toHaveBeenCalledTimes(2);
  });

  it('keeps review notification failures isolated from booking and review writes', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    prismaTransaction.mockRejectedValue(new Error('database unavailable'));

    await expect(service.createReviewEligibilityNotifications()).resolves.toBe(
      0,
    );
    expect(error).toHaveBeenCalledWith(
      'Failed to create review eligibility notifications',
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

  it('bulk-creates system notifications before starting web push', async () => {
    await expect(
      service.broadcastToAllUsers({ title: INPUT.title, body: INPUT.body }),
    ).resolves.toBe(2);
    expect(userFindMany).toHaveBeenCalledWith({ select: { id: true } });
    expect(notificationCreateMany).toHaveBeenCalledTimes(1);
    expect(notificationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          userId: USER_ID,
          type: NotificationType.SYSTEM,
          title: INPUT.title,
          body: INPUT.body,
        },
        {
          userId: OTHER_USER_ID,
          type: NotificationType.SYSTEM,
          title: INPUT.title,
          body: INPUT.body,
        },
      ],
    });
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(sendToUsers).toHaveBeenCalledWith([USER_ID, OTHER_USER_ID], {
      title: INPUT.title,
      body: INPUT.body,
    });
    expect(notificationCreateMany.mock.invocationCallOrder[0]).toBeLessThan(
      sendToUsers.mock.invocationCallOrder[0],
    );
  });

  it('does not write or push when there are no broadcast recipients', async () => {
    userFindMany.mockResolvedValue([]);

    await expect(
      service.broadcastToAllUsers({ title: INPUT.title, body: INPUT.body }),
    ).resolves.toBe(0);
    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('keeps the broadcast recipient result when web push fails', async () => {
    sendToUsers.mockRejectedValue(new Error('push unavailable'));

    await expect(
      service.broadcastToAllUsers({ title: INPUT.title, body: INPUT.body }),
    ).resolves.toBe(2);
  });

  it('logs and returns zero when system broadcast fan-out fails', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    notificationCreateMany.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.broadcastToAllUsers({ title: INPUT.title, body: INPUT.body }),
    ).resolves.toBe(0);
    expect(sendToUsers).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Failed to fan out a system broadcast notification',
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
