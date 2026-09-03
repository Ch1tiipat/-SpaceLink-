import {
  BadRequestException,
  Controller,
  type INestApplication,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { MAX_SHOP_LOGO_FILE_SIZE_BYTES } from './shop-logo-storage.service';
import { SHOP_LOGO_UPLOAD_LIMITS, ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

/*
 * `jose` ships ESM only and SupabaseAuthGuard reaches it through
 * SupabaseTokenService. This suite never runs a real guard — it only inspects
 * the metadata the decorators attached — so stubbing the guard keeps the
 * import loadable under the CommonJS jest setup. Same shim as
 * bookings.controller.spec.ts.
 */
jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CURRENT_USER: User = {
  id: OWNER_ID,
  authUserId: '22222222-2222-4222-8222-222222222222',
  email: 'vendor@example.com',
  fullName: 'Vendor One',
  phone: null,
  role: UserRole.VENDOR,
  trustScore: 100,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const CREATE_DTO: CreateShopDto = {
  name: 'ร้านขนมไทย',
  categoryIds: ['33333333-3333-4333-8333-333333333333'],
};
const UPDATE_DTO: UpdateShopDto = { name: 'ชื่อใหม่' };

const LOGO_FILE = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) };

const create = jest.fn();
const updateMe = jest.fn();
const uploadLogo = jest.fn();
const mockShopsService = { create, updateMe, uploadLogo };

@Controller('shop-logo-multipart-probe')
class ShopLogoMultipartProbeController {
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: SHOP_LOGO_UPLOAD_LIMITS }))
  upload(@UploadedFile() file: { originalname: string } | undefined) {
    return { originalname: file?.originalname };
  }
}

function controllerHandler(name: 'create' | 'updateMe' | 'uploadLogo'): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    ShopsController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`Missing controller handler: ${name}`);
  }
  return descriptor.value as object;
}

describe('ShopsController', () => {
  let controller: ShopsController;
  let multipartApp: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ShopLogoMultipartProbeController],
    }).compile();

    multipartApp = module.createNestApplication();
    await multipartApp.init();
  });

  afterAll(async () => {
    await multipartApp.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopsController],
      providers: [{ provide: ShopsService, useValue: mockShopsService }],
    }).compile();

    controller = module.get<ShopsController>(ShopsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('runs authentication before role authorization', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ShopsController)).toEqual([
      SupabaseAuthGuard,
      RolesGuard,
    ]);
  });

  it('restricts every route to vendors', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ShopsController)).toEqual([
      UserRole.VENDOR,
    ]);
    // No per-route override anywhere, so the class-level VENDOR restriction is
    // what applies to all three.
    expect(
      Reflect.getMetadata(ROLES_KEY, controllerHandler('create')),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, controllerHandler('updateMe')),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, controllerHandler('uploadLogo')),
    ).toBeUndefined();
  });

  /*
   * Scope guard: SCRUM-59 Phase 1's two routes plus SCRUM-66's logo upload. A
   * read or delete route appearing here without a ticket is the kind of scope
   * creep §2.3 forbids.
   */
  it('exposes no other handlers', () => {
    expect(ShopsController.prototype).not.toHaveProperty('findAll');
    expect(ShopsController.prototype).not.toHaveProperty('findOne');
    expect(ShopsController.prototype).not.toHaveProperty('remove');
  });

  it('passes the authenticated user id when creating a shop', async () => {
    create.mockResolvedValue({ id: 'shop-1' });

    await controller.create(CREATE_DTO, CURRENT_USER);

    expect(create).toHaveBeenCalledWith(CREATE_DTO, OWNER_ID);
  });

  it('passes the authenticated user id when updating the own shop', async () => {
    updateMe.mockResolvedValue({ id: 'shop-1' });

    await controller.updateMe(UPDATE_DTO, CURRENT_USER);

    expect(updateMe).toHaveBeenCalledWith(UPDATE_DTO, OWNER_ID);
  });

  it('passes the authenticated user id when uploading a logo', async () => {
    uploadLogo.mockResolvedValue({ id: 'shop-1' });

    await controller.uploadLogo(LOGO_FILE, CURRENT_USER);

    expect(uploadLogo).toHaveBeenCalledWith(LOGO_FILE, OWNER_ID);
  });

  /*
   * Multer puts nothing on the request when the part is missing or misnamed, so
   * without this the service would be handed `undefined` and fail on a property
   * read instead of answering a Thai 400.
   */
  it('rejects a logo upload with no file part', () => {
    expect(() => controller.uploadLogo(undefined, CURRENT_USER)).toThrow(
      new BadRequestException('กรุณาแนบไฟล์โลโก้'),
    );
    expect(uploadLogo).not.toHaveBeenCalled();
  });

  it('caps the multipart body at the logo size limit and one file', () => {
    expect(SHOP_LOGO_UPLOAD_LIMITS).toEqual({
      files: 1,
      fields: 0,
      parts: 2,
      fileSize: MAX_SHOP_LOGO_FILE_SIZE_BYTES,
    });
  });

  it('accepts the one file part used by a browser FormData upload', async () => {
    await request(multipartApp.getHttpServer() as Server)
      .post('/shop-logo-multipart-probe')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'shop-logo.png',
        contentType: 'image/png',
      })
      .expect(201)
      .expect({ originalname: 'shop-logo.png' });
  });
});
