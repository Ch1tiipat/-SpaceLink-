import { createHmac } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import type { JWTPayload } from 'jose';
import { jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { SupabaseTokenService } from './supabase-token.service';
import { UserProvisioningService } from './user-provisioning.service';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'vendor@example.com';
const SUPABASE_URL = 'https://unit-test.supabase.co';
const JWT_SECRET = 'unit-test-secret';

const USER: User = {
  id: USER_ID,
  authUserId: AUTH_USER_ID,
  email: EMAIL,
  fullName: 'Vendor Name',
  phone: null,
  role: 'VENDOR',
  trustScore: 100,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-18T00:00:00.000Z'),
  updatedAt: new Date('2026-08-18T00:00:00.000Z'),
};

const userFindUnique = jest.fn();
const userCreate = jest.fn();
const mockPrismaService = {
  user: {
    findUnique: userFindUnique,
    create: userCreate,
  },
};

function signSyntheticToken(payload: JWTPayload): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${header}.${body}`;
  const signature = createHmac('sha256', JWT_SECRET)
    .update(unsignedToken)
    .digest('base64url');
  return `${unsignedToken}.${signature}`;
}

function installSyntheticJwtVerifier() {
  const jwtVerifyMock = jwtVerify as jest.MockedFunction<typeof jwtVerify>;
  jwtVerifyMock.mockImplementation(((
    token: string | Uint8Array,
    key: Uint8Array,
  ) => {
    const rawToken =
      typeof token === 'string' ? token : Buffer.from(token).toString();
    const [header, body, signature] = rawToken.split('.');
    const expectedSignature = createHmac('sha256', key)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new Error('Invalid synthetic signature');
    }

    return Promise.resolve({
      payload: JSON.parse(
        Buffer.from(body, 'base64url').toString(),
      ) as JWTPayload,
      protectedHeader: { alg: 'HS256' },
    });
  }) as typeof jwtVerify);
}

function createTokenService(): SupabaseTokenService {
  const config = {
    get: jest.fn((key: string) =>
      key === 'SUPABASE_JWT_SECRET' ? JWT_SECRET : undefined,
    ),
    getOrThrow: jest.fn(() => SUPABASE_URL),
  } as unknown as ConfigService;

  return new SupabaseTokenService(config);
}

describe('UserProvisioningService', () => {
  let service: UserProvisioningService;

  beforeEach(() => {
    jest.clearAllMocks();
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue(USER);
    service = new UserProvisioningService(
      mockPrismaService as unknown as PrismaService,
    );
  });

  it('uses a supplied fullName after trimming it', async () => {
    await service.findOrCreate(AUTH_USER_ID, EMAIL, '  ชื่อ ผู้ขาย  ');

    expect(userCreate).toHaveBeenCalledWith({
      data: {
        authUserId: AUTH_USER_ID,
        email: EMAIL,
        fullName: 'ชื่อ ผู้ขาย',
        role: 'VENDOR',
      },
    });
  });

  it.each([undefined, '', '   '])(
    'falls back to the email local part when fullName is %p',
    async (fullName) => {
      await service.findOrCreate(AUTH_USER_ID, EMAIL, fullName);

      expect(userCreate).toHaveBeenCalledWith({
        data: {
          authUserId: AUTH_USER_ID,
          email: EMAIL,
          fullName: 'vendor',
          role: 'VENDOR',
        },
      });
    },
  );

  it('returns an existing user without changing its stored fullName', async () => {
    userFindUnique.mockResolvedValue(USER);

    await expect(
      service.findOrCreate(AUTH_USER_ID, EMAIL, 'Different Name'),
    ).resolves.toBe(USER);
    expect(userCreate).not.toHaveBeenCalled();
  });
});

describe('SupabaseTokenService fullName claims', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installSyntheticJwtVerifier();
  });

  it('extracts user_metadata.full_name from a synthetic signed token', async () => {
    const token = signSyntheticToken({
      sub: AUTH_USER_ID,
      email: EMAIL,
      iss: `${SUPABASE_URL}/auth/v1`,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 60,
      user_metadata: { full_name: 'ชื่อจาก Supabase' },
    });

    await expect(createTokenService().verify(token)).resolves.toEqual({
      sub: AUTH_USER_ID,
      email: EMAIL,
      fullName: 'ชื่อจาก Supabase',
    });
  });

  it('keeps fullName optional when user_metadata is absent', async () => {
    const token = signSyntheticToken({
      sub: AUTH_USER_ID,
      email: EMAIL,
      iss: `${SUPABASE_URL}/auth/v1`,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    await expect(createTokenService().verify(token)).resolves.toEqual({
      sub: AUTH_USER_ID,
      email: EMAIL,
      fullName: undefined,
    });
  });
});

describe('SupabaseAuthGuard fullName handoff', () => {
  it('passes the verified fullName to just-in-time provisioning', async () => {
    const request = { headers: { authorization: 'Bearer synthetic-token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const tokenService = {
      verify: jest.fn().mockResolvedValue({
        sub: AUTH_USER_ID,
        email: EMAIL,
        fullName: 'ชื่อจาก Supabase',
      }),
    };
    const userProvisioning = {
      findOrCreate: jest.fn().mockResolvedValue(USER),
    };
    const guard = new SupabaseAuthGuard(
      tokenService as unknown as SupabaseTokenService,
      userProvisioning as unknown as UserProvisioningService,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(userProvisioning.findOrCreate).toHaveBeenCalledWith(
      AUTH_USER_ID,
      EMAIL,
      'ชื่อจาก Supabase',
    );
    expect(request).toHaveProperty('user', USER);
  });
});
