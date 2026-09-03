import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, type TestingModule } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const CURRENT_USER: User = {
  id: USER_ID,
  authUserId: '33333333-3333-4333-8333-333333333333',
  email: 'vendor@example.com',
  fullName: 'Vendor One',
  phone: null,
  role: UserRole.VENDOR,
  trustScore: 100,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-18T00:00:00.000Z'),
  updatedAt: new Date('2026-08-18T00:00:00.000Z'),
};

const findMine = jest.fn();
const unreadCount = jest.fn();
const markRead = jest.fn();
const markAllRead = jest.fn();
const mockNotificationsService = {
  findMine,
  unreadCount,
  markRead,
  markAllRead,
};

function controllerHandler(
  name: 'findMine' | 'unreadCount' | 'markRead' | 'markAllRead',
): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    NotificationsController.prototype,
    name,
  );
  if (!descriptor) throw new Error(`Missing controller handler: ${name}`);
  return descriptor.value as object;
}

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('runs authentication before role authorization', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, NotificationsController),
    ).toEqual([SupabaseAuthGuard, RolesGuard]);
  });

  it('allows every authenticated role without role metadata', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, NotificationsController),
    ).toBeUndefined();
    for (const name of [
      'findMine',
      'unreadCount',
      'markRead',
      'markAllRead',
    ] as const) {
      expect(
        Reflect.getMetadata(ROLES_KEY, controllerHandler(name)),
      ).toBeUndefined();
    }
  });

  it('lists only the current user notifications', async () => {
    findMine.mockResolvedValue([]);

    await controller.findMine(CURRENT_USER, { unreadOnly: true });

    expect(findMine).toHaveBeenCalledWith(USER_ID, true);
  });

  it('returns the current user unread count', async () => {
    unreadCount.mockResolvedValue({ count: 2 });

    await expect(controller.unreadCount(CURRENT_USER)).resolves.toEqual({
      count: 2,
    });
    expect(unreadCount).toHaveBeenCalledWith(USER_ID);
  });

  it('passes ownership context when marking one notification', async () => {
    markRead.mockResolvedValue({ count: 1 });

    await controller.markRead(NOTIFICATION_ID, CURRENT_USER);

    expect(markRead).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID);
  });

  it('marks all notifications for the current user only', async () => {
    markAllRead.mockResolvedValue({ count: 3 });

    await controller.markAllRead(CURRENT_USER);

    expect(markAllRead).toHaveBeenCalledWith(USER_ID);
  });

  it('transforms true and false query strings into booleans', async () => {
    const unread = plainToInstance(ListNotificationsQueryDto, {
      unreadOnly: 'true',
    });
    const all = plainToInstance(ListNotificationsQueryDto, {
      unreadOnly: 'false',
    });

    await expect(validate(unread)).resolves.toHaveLength(0);
    await expect(validate(all)).resolves.toHaveLength(0);
    expect(unread.unreadOnly).toBe(true);
    expect(all.unreadOnly).toBe(false);
  });

  it('rejects an invalid unreadOnly query value', async () => {
    const query = plainToInstance(ListNotificationsQueryDto, {
      unreadOnly: 'yes',
    });

    await expect(validate(query)).resolves.toHaveLength(1);
  });
});
