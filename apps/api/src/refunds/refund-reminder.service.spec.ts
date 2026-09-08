import { Logger } from '@nestjs/common';
import { MembershipRole, RefundStatus, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefundReminderService } from './refund-reminder.service';

describe('RefundReminderService', () => {
  const findFirst = jest.fn();
  const previous = jest.fn<
    Promise<{ id: string } | null>,
    [{ where: Record<string, unknown> }]
  >();
  const lock = jest.fn();
  const send = jest.fn<
    Promise<{ id: string } | null>,
    [string, Record<string, unknown>]
  >();
  const supers = jest.fn();
  const tx = {
    $queryRaw: lock,
    refundRequest: { findFirst },
    orgMembership: { findMany: jest.fn() },
    user: { findMany: supers },
    notification: { findFirst: previous },
  };
  const prisma = {
    refundRequest: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new RefundReminderService(
    prisma as unknown as PrismaService,
    { createForUser: send } as unknown as NotificationsService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.refundRequest.findMany.mockResolvedValue([{ id: 'refund' }]);
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => Promise<void>) => fn(tx),
    );
    lock.mockResolvedValue([{ id: 'refund' }]);
    findFirst.mockResolvedValue({
      status: RefundStatus.PENDING,
      booking: { event: { organizationId: 'org' } },
    });
    tx.orgMembership.findMany.mockResolvedValue([{ userId: 'admin' }]);
    supers.mockResolvedValue([{ id: 'super' }]);
    previous.mockResolvedValue(null);
    send.mockResolvedValue({ id: 'notification' });
  });
  it('reminds only org admins for pending and uses strict age thresholds', async () => {
    await service.remindOverdue();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe('admin');
    expect(tx.orgMembership.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org',
        role: MembershipRole.ADMIN,
        canManagePayments: true,
        user: { role: UserRole.ORG_ADMIN },
      },
      select: { userId: true },
    });
    expect(supers).not.toHaveBeenCalled();
    const calls = prisma.refundRequest.findMany.mock.calls as unknown as [
      {
        where: {
          OR: [{ createdAt: { lt: Date } }, { reviewedAt: { lt: Date } }];
        };
      },
    ][];
    const where = calls[0][0].where;
    expect(
      where.OR[1].reviewedAt.lt.getTime() - where.OR[0].createdAt.lt.getTime(),
    ).toBe(-86400000);
  });
  it('falls back to the organization owner when no finance admin is delegated', async () => {
    tx.orgMembership.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: 'owner' }]);

    await service.remindOverdue();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe('owner');
    expect(tx.orgMembership.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: 'org',
        role: MembershipRole.OWNER,
        user: { role: UserRole.ORG_ADMIN },
      },
      select: { userId: true },
    });
  });
  it('escalates approved refunds to super admins without exposing payout details', async () => {
    findFirst.mockResolvedValue({
      status: RefundStatus.APPROVED,
      booking: { event: { organizationId: 'org' } },
    });
    await service.remindOverdue();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBe('super');
    expect(send.mock.calls[1][1]).not.toHaveProperty('payoutAccountNumber');
  });
  it('skips a concurrently locked refund', async () => {
    lock.mockResolvedValue([]);
    await service.remindOverdue();
    expect(send).not.toHaveBeenCalled();
  });
  it('rechecks state and skips processed requests', async () => {
    findFirst.mockResolvedValue(null);
    await service.remindOverdue();
    expect(send).not.toHaveBeenCalled();
  });
  it('deduplicates recent reminders even when read', async () => {
    previous.mockResolvedValue({ id: 'old' });
    await service.remindOverdue();
    expect(send).not.toHaveBeenCalled();
    expect(previous.mock.calls[0][0].where).not.toHaveProperty('isRead');
  });
  it('contains database failures without logging personal information', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    prisma.refundRequest.findMany.mockRejectedValue(new Error('sensitive'));
    await expect(service.remindOverdue()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('Failed to query overdue refunds');
    log.mockRestore();
  });
});
