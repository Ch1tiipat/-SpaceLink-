import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingSlipStorageService,
  MAX_SLIP_FILE_SIZE_BYTES,
  SIGNED_URL_TTL_SECONDS,
} from './booking-slip-storage.service';

const SUPABASE_URL = 'https://project.supabase.co';
const SERVICE_ROLE_KEY = 'test-service-role-key';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

describe('BookingSlipStorageService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let service: BookingSlipStorageService;

  beforeEach(() => {
    const values: Record<string, string> = {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    };
    const getOrThrow = jest.fn((key: string): string => values[key]);
    const config = { getOrThrow } as unknown as ConfigService;

    fetchMock = jest.spyOn(globalThis, 'fetch');
    service = new BookingSlipStorageService(config);
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it.each([
    ['PNG', PNG, 'image/png', 'png'],
    ['JPEG', JPEG, 'image/jpeg', 'jpg'],
  ])(
    'uploads a real %s signature with a server-generated name',
    async (_label, buffer, contentType, extension) => {
      fetchMock
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              signedURL:
                '/object/sign/slips/vendor/booking/file?token=short-lived',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );

      const result = await service.uploadForVerification(
        { buffer },
        'booking-id',
        'vendor-id',
      );

      const [uploadUrl, uploadInit] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(uploadUrl).toMatch(
        new RegExp(
          `^${SUPABASE_URL}/storage/v1/object/slips/vendor-id/booking-id/[a-f0-9-]+\\.${extension}$`,
        ),
      );
      expect(uploadInit).toMatchObject({
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
      });
      expect(result.objectPath).toMatch(
        new RegExp(`^vendor-id/booking-id/[a-f0-9-]+\\.${extension}$`),
      );
      expect(result.verificationUrl).toBe(
        `${SUPABASE_URL}/storage/v1/object/sign/slips/vendor/booking/file?token=short-lived`,
      );
    },
  );

  it('requests a five-minute signed URL after uploading', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ signedUrl: '/signed/path?token=test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await service.uploadForVerification(
      { buffer: PNG },
      'booking-id',
      'vendor-id',
    );

    const [signUrl, signInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(signUrl).toMatch(
      /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/sign\/slips\/vendor-id\/booking-id\/[a-f0-9-]+\.png$/,
    );
    expect(signInit.body).toBe(JSON.stringify({ expiresIn: 300 }));
    expect(signInit.signal).toBeInstanceOf(AbortSignal);
  });

  it('creates short-lived view and download URLs without persisting either', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ signedUrl: '/signed/path?token=test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      service.createAdminAccess('vendor-id/booking-id/stored-slip.png'),
    ).resolves.toEqual({
      viewUrl: `${SUPABASE_URL}/storage/v1/signed/path?token=test`,
      downloadUrl: `${SUPABASE_URL}/storage/v1/signed/path?token=test&download=payment-slip.png`,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    });

    const [, signInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(signInit.body).toBe(
      JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    );
  });

  it('rejects content whose bytes are not JPEG or PNG', async () => {
    await expect(
      service.uploadForVerification(
        { buffer: Buffer.from('not an image') },
        'booking-id',
        'vendor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty file', async () => {
    await expect(
      service.uploadForVerification(
        { buffer: Buffer.alloc(0) },
        'booking-id',
        'vendor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a file larger than five megabytes', async () => {
    const oversized = Buffer.alloc(MAX_SLIP_FILE_SIZE_BYTES + 1);
    oversized.set(PNG);

    await expect(
      service.uploadForVerification(
        { buffer: oversized },
        'booking-id',
        'vendor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a safe error when storage upload fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(
      service.uploadForVerification({ buffer: PNG }, 'booking-id', 'vendor-id'),
    ).rejects.toThrow('ไม่สามารถจัดเก็บสลิปได้');
  });

  it('bounds repeated storage timeouts and cleans up safely', async () => {
    const timeout = Object.assign(new Error('private timeout detail'), {
      name: 'TimeoutError',
    });
    fetchMock
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(
      service.uploadForVerification({ buffer: PNG }, 'booking-id', 'vendor-id'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns a safe error when signing has no URL', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      service.uploadForVerification({ buffer: PNG }, 'booking-id', 'vendor-id'),
    ).rejects.toBeInstanceOf(BadGatewayException);

    const [removeUrl, removeInit] = fetchMock.mock.calls[2] as [
      string,
      RequestInit,
    ];
    expect(removeUrl).toMatch(
      /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/slips\/vendor-id\/booking-id\/[a-f0-9-]+\.png$/,
    );
    expect(removeInit.method).toBe('DELETE');
  });

  it('deletes a stored object through the private storage API', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await service.removeObject('vendor-id/booking-id/file name.png');

    expect(fetchMock).toHaveBeenCalledWith(
      `${SUPABASE_URL}/storage/v1/object/slips/vendor-id/booking-id/file%20name.png`,
      expect.objectContaining({
        method: 'DELETE',
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );
  });
});
