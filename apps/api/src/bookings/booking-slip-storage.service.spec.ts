import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingSlipStorageService,
  MAX_SLIP_FILE_SIZE_BYTES,
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
                '/storage/v1/object/sign/slips/vendor/booking/file?token=short-lived',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );

      const result = await service.uploadAndCreateSignedUrl(
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
      expect(result).toBe(
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

    await service.uploadAndCreateSignedUrl(
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
  });

  it('rejects content whose bytes are not JPEG or PNG', async () => {
    await expect(
      service.uploadAndCreateSignedUrl(
        { buffer: Buffer.from('not an image') },
        'booking-id',
        'vendor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty file', async () => {
    await expect(
      service.uploadAndCreateSignedUrl(
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
      service.uploadAndCreateSignedUrl(
        { buffer: oversized },
        'booking-id',
        'vendor-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a safe error when storage upload fails', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(
      service.uploadAndCreateSignedUrl(
        { buffer: PNG },
        'booking-id',
        'vendor-id',
      ),
    ).rejects.toThrow('ไม่สามารถจัดเก็บสลิปได้');
  });

  it('returns a safe error when signing has no URL', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(
      service.uploadAndCreateSignedUrl(
        { buffer: PNG },
        'booking-id',
        'vendor-id',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
