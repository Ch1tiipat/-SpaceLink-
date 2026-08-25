import { ConfigService } from '@nestjs/config';
import { UserLastLoginService } from './user-last-login.service';

const SUPABASE_URL = 'https://project.supabase.co';
const SERVICE_ROLE_KEY = 'test-service-role-key';
const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';

describe('UserLastLoginService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let service: UserLastLoginService;

  beforeEach(() => {
    const values: Record<string, string> = {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    };
    const getOrThrow = jest.fn((key: string): string => values[key]);
    const config = { getOrThrow } as unknown as ConfigService;

    fetchMock = jest.spyOn(globalThis, 'fetch');
    service = new UserLastLoginService(config);
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.restoreAllMocks();
  });

  it('requests the Supabase Auth Admin API with service-role credentials', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ last_sign_in_at: '2026-08-20T10:00:00Z' }),
        { status: 200 },
      ),
    );

    await service.getLastSignInAt(AUTH_USER_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      `${SUPABASE_URL}/auth/v1/admin/users/${AUTH_USER_ID}`,
      expect.objectContaining({
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }),
    );
  });

  it('returns the last_sign_in_at value on success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ last_sign_in_at: '2026-08-20T10:00:00Z' }),
        { status: 200 },
      ),
    );

    await expect(service.getLastSignInAt(AUTH_USER_ID)).resolves.toBe(
      '2026-08-20T10:00:00Z',
    );
  });

  it('returns null when the user has never signed in', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ last_sign_in_at: null }), { status: 200 }),
    );

    await expect(service.getLastSignInAt(AUTH_USER_ID)).resolves.toBeNull();
  });

  it('returns null instead of throwing on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(service.getLastSignInAt(AUTH_USER_ID)).resolves.toBeNull();
  });

  it('returns null instead of throwing when the request itself fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(service.getLastSignInAt(AUTH_USER_ID)).resolves.toBeNull();
  });
});
