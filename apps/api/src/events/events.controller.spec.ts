import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const EVENT_ID = '00000000-0000-4000-8000-000000000002';

const findMapBySlug = jest.fn();
const getSavedEventIds = jest.fn();
const saveEvent = jest.fn();
const unsaveEvent = jest.fn();
const mockEventsService = {
  findMapBySlug,
  getSavedEventIds,
  saveEvent,
  unsaveEvent,
};

function handlerOf(name: string): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    EventsController.prototype,
    name,
  );
  if (!descriptor) throw new Error(`Missing controller handler: ${name}`);
  return descriptor.value as object;
}

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new EventsController(
      mockEventsService as unknown as EventsService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates a public slug map lookup to the service', async () => {
    findMapBySlug.mockResolvedValue({ event: { id: 'event-1' }, zones: [] });

    await expect(
      controller.findMapBySlug('future-tech-abc123'),
    ).resolves.toEqual({ event: { id: 'event-1' }, zones: [] });
    expect(findMapBySlug).toHaveBeenCalledWith('future-tech-abc123');
  });

  it('keeps the existing event discovery and map routes public', () => {
    for (const name of [
      'findAll',
      'findDiscovery',
      'findMapBySlug',
      'findMap',
    ]) {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, handlerOf(name)),
      ).toBeUndefined();
    }
  });

  it.each(['getSaved', 'save', 'unsave'])(
    'allows every authenticated platform role to use %s',
    (name) => {
      // พฤติกรรมปัจจุบัน รอ PO ยืนยัน (AUTH-01) — ห้ามแก้โดยไม่อัปเดต test นี้
      expect(Reflect.getMetadata(GUARDS_METADATA, handlerOf(name))).toEqual([
        SupabaseAuthGuard,
      ]);
      expect(Reflect.getMetadata(ROLES_KEY, handlerOf(name))).toBeUndefined();
    },
  );

  it.each(['save', 'unsave'])('returns no content from %s', (name) => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handlerOf(name))).toBe(204);
  });

  it('returns 401 without login and allows every authenticated role to save idempotently', async () => {
    // พฤติกรรมปัจจุบัน รอ PO ยืนยัน (AUTH-01) — ห้ามแก้โดยไม่อัปเดต test นี้
    let authenticated = false;
    let currentRole: UserRole = UserRole.VENDOR;
    const fakeAuthGuard = {
      canActivate(context: ExecutionContext) {
        if (!authenticated) {
          throw new UnauthorizedException('Missing bearer token');
        }
        const httpRequest = context
          .switchToHttp()
          .getRequest<{ user?: User }>();
        httpRequest.user = {
          id: USER_ID,
          role: currentRole,
        } as User;
        return true;
      },
    };
    getSavedEventIds.mockResolvedValue([EVENT_ID]);
    saveEvent.mockResolvedValue(undefined);
    unsaveEvent.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: mockEventsService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(fakeAuthGuard)
      .compile();
    const app = module.createNestApplication();
    await app.init();

    try {
      await request(app.getHttpServer() as Server)
        .get('/events/saved')
        .expect(401);
      await request(app.getHttpServer() as Server)
        .post(`/events/${EVENT_ID}/save`)
        .expect(401);
      await request(app.getHttpServer() as Server)
        .delete(`/events/${EVENT_ID}/save`)
        .expect(401);

      authenticated = true;
      await request(app.getHttpServer() as Server)
        .get('/events/saved')
        .expect(200)
        .expect([EVENT_ID]);

      for (const role of [
        UserRole.VENDOR,
        UserRole.ORG_ADMIN,
        UserRole.SUPER_ADMIN,
      ]) {
        currentRole = role;
        await request(app.getHttpServer() as Server)
          .post(`/events/${EVENT_ID}/save`)
          .expect(204);
        await request(app.getHttpServer() as Server)
          .post(`/events/${EVENT_ID}/save`)
          .expect(204);
        await request(app.getHttpServer() as Server)
          .delete(`/events/${EVENT_ID}/save`)
          .expect(204);
      }

      expect(getSavedEventIds).toHaveBeenCalledWith(USER_ID);
      expect(saveEvent).toHaveBeenCalledTimes(6);
      expect(saveEvent).toHaveBeenCalledWith(EVENT_ID, USER_ID);
      expect(unsaveEvent).toHaveBeenCalledTimes(3);
      expect(unsaveEvent).toHaveBeenCalledWith(EVENT_ID, USER_ID);
    } finally {
      await app.close();
    }
  });
});
