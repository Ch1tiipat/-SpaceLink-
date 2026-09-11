import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventBannerStorageService,
  MAX_EVENT_BANNER_DIMENSION_PX,
  MAX_EVENT_BANNER_FILE_SIZE_BYTES,
} from './event-banner-storage.service';

const SUPABASE_URL = 'https://project.supabase.co';
const SERVICE_ROLE_KEY = 'test-service-role-key';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';

function pngOf(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpegOf(width: number, height: number): Buffer {
  const buffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
    0x08, 0x00, 0x00, 0x00, 0x00,
  ]);
  buffer.writeUInt16BE(height, 13);
  buffer.writeUInt16BE(width, 15);
  return buffer;
}

const BANNER_CASES: ReadonlyArray<
  readonly [string, Buffer, 'image/jpeg' | 'image/png']
> = [
  ['JPEG', jpegOf(1600, 900), 'image/jpeg'],
  ['PNG', pngOf(1600, 900), 'image/png'],
];

describe('EventBannerStorageService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let service: EventBannerStorageService;

  beforeEach(() => {
    const values: Record<string, string> = {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    };
    const config = {
      getOrThrow: jest.fn((key: string): string => values[key]),
    } as unknown as ConfigService;
    fetchMock = jest.spyOn(globalThis, 'fetch');
    service = new EventBannerStorageService(config);
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.restoreAllMocks();
  });

  it('uploads validated JPEG and PNG banners to unique event paths', async () => {
    for (const [, image, contentType] of BANNER_CASES) {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

      const url = await service.uploadForEvent({ buffer: image }, EVENT_ID);

      expect(url).toMatch(
        new RegExp(
          `^${SUPABASE_URL}/storage/v1/object/public/event-banners/${EVENT_ID}/[0-9a-f-]{36}$`,
        ),
      );
      const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(requestUrl).toBe(url.replace('/object/public/', '/object/'));
      expect(requestInit.method).toBe('POST');
      expect(new Headers(requestInit.headers).get('Content-Type')).toBe(
        contentType,
      );
      expect(new Headers(requestInit.headers).get('x-upsert')).toBe('false');
      fetchMock.mockClear();
    }
  });

  it('rejects empty, oversized, damaged, and over-dimension images', async () => {
    const oversized = Buffer.alloc(MAX_EVENT_BANNER_FILE_SIZE_BYTES + 1);
    oversized.set(pngOf(100, 100));

    await expect(
      service.uploadForEvent({ buffer: Buffer.alloc(0) }, EVENT_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadForEvent({ buffer: oversized }, EVENT_ID),
    ).rejects.toThrow('ขนาดไม่เกิน 2 MB');
    await expect(
      service.uploadForEvent({ buffer: Buffer.from('not an image') }, EVENT_ID),
    ).rejects.toThrow('JPEG และ PNG');
    await expect(
      service.uploadForEvent(
        { buffer: pngOf(MAX_EVENT_BANNER_DIMENSION_PX + 1, 900) },
        EVENT_ID,
      ),
    ).rejects.toThrow('ไม่เกิน 2000 พิกเซล');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes only URLs owned by the event banner bucket', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const stored = `${SUPABASE_URL}/storage/v1/object/public/event-banners/${EVENT_ID}/11111111-1111-4111-8111-111111111111`;

    await service.removeByUrl(stored);
    await service.removeByUrl('https://attacker.example/event-banners/file');
    await service.removeByUrl(
      `${SUPABASE_URL}/storage/v1/object/public/event-gallery/${EVENT_ID}/file`,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${SUPABASE_URL}/storage/v1/object/event-banners`,
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          prefixes: [`${EVENT_ID}/11111111-1111-4111-8111-111111111111`],
        }),
      }),
    );
  });

  it('bounds repeated storage timeouts', async () => {
    const timeout = Object.assign(new Error('private detail'), {
      name: 'TimeoutError',
    });
    fetchMock.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout);

    await expect(
      service.uploadForEvent({ buffer: pngOf(100, 100) }, EVENT_ID),
    ).rejects.toThrow(new BadGatewayException('หมดเวลารอจัดเก็บภาพปกอีเวนต์'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
