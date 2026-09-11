import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventGalleryStorageService,
  MAX_EVENT_GALLERY_DIMENSION_PX,
  MAX_EVENT_GALLERY_FILES,
  MAX_EVENT_GALLERY_FILE_SIZE_BYTES,
} from './event-gallery-storage.service';

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

const PNG = pngOf(640, 480);
const JPEG = jpegOf(800, 600);

describe('EventGalleryStorageService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let service: EventGalleryStorageService;

  beforeEach(() => {
    const values: Record<string, string> = {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    };
    const config = {
      getOrThrow: jest.fn((key: string): string => values[key]),
    } as unknown as ConfigService;
    fetchMock = jest.spyOn(globalThis, 'fetch');
    service = new EventGalleryStorageService(config);
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.restoreAllMocks();
  });

  it('uploads JPEG and PNG files in order to unique extensionless paths', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const urls = await service.uploadForEvent(
      [{ buffer: JPEG }, { buffer: PNG }],
      EVENT_ID,
    );

    expect(urls).toHaveLength(2);
    expect(new Set(urls).size).toBe(2);
    expect(urls[0]).toMatch(
      new RegExp(
        `^${SUPABASE_URL}/storage/v1/object/public/event-gallery/${EVENT_ID}/[0-9a-f-]{36}$`,
      ),
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
      urls.map((url) => String(url).replace('/object/public/', '/object/')),
    );
    const firstInit = fetchMock.mock.calls[0][1] as RequestInit;
    const secondInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(firstInit.method).toBe('POST');
    expect(new Headers(firstInit.headers).get('Content-Type')).toBe(
      'image/jpeg',
    );
    expect(new Headers(firstInit.headers).get('x-upsert')).toBe('false');
    expect(new Headers(secondInit.headers).get('Content-Type')).toBe(
      'image/png',
    );
  });

  it('validates every file before starting the batch upload', async () => {
    await expect(
      service.uploadForEvent(
        [{ buffer: PNG }, { buffer: Buffer.from('not an image') }],
        EVENT_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty batch and more than ten files', async () => {
    await expect(service.uploadForEvent([], EVENT_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.uploadForEvent(
        Array.from({ length: MAX_EVENT_GALLERY_FILES + 1 }, () => ({
          buffer: PNG,
        })),
        EVENT_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversized bytes and pixel dimensions', async () => {
    const oversized = Buffer.alloc(MAX_EVENT_GALLERY_FILE_SIZE_BYTES + 1);
    oversized.set(PNG);

    await expect(
      service.uploadForEvent([{ buffer: oversized }], EVENT_ID),
    ).rejects.toThrow('ขนาดไม่เกิน 2 MB');
    await expect(
      service.uploadForEvent(
        [{ buffer: pngOf(MAX_EVENT_GALLERY_DIMENSION_PX + 1, 400) }],
        EVENT_ID,
      ),
    ).rejects.toThrow('ไม่เกิน 2000 พิกเซล');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cleans objects uploaded earlier when a later upload fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      service.uploadForEvent([{ buffer: PNG }, { buffer: JPEG }], EVENT_ID),
    ).rejects.toBeInstanceOf(BadGatewayException);

    const [deleteUrl, deleteInit] = fetchMock.mock.calls[3] as [
      string,
      RequestInit,
    ];
    expect(deleteUrl).toBe(`${SUPABASE_URL}/storage/v1/object/event-gallery`);
    expect(deleteInit.method).toBe('DELETE');
    expect(typeof deleteInit.body).toBe('string');
    expect(JSON.parse(deleteInit.body as string) as unknown).toEqual({
      prefixes: [expect.stringMatching(new RegExp(`^${EVENT_ID}/`))],
    });
  });

  it('deletes stored objects through the Storage API', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const urls = [
      `${SUPABASE_URL}/storage/v1/object/public/event-gallery/${EVENT_ID}/11111111-1111-4111-8111-111111111111`,
      `${SUPABASE_URL}/storage/v1/object/public/event-gallery/${EVENT_ID}/33333333-3333-4333-8333-333333333333`,
    ];

    await service.removeByUrls(urls);

    expect(fetchMock).toHaveBeenCalledWith(
      `${SUPABASE_URL}/storage/v1/object/event-gallery`,
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          prefixes: [
            `${EVENT_ID}/11111111-1111-4111-8111-111111111111`,
            `${EVENT_ID}/33333333-3333-4333-8333-333333333333`,
          ],
        }),
      }),
    );
  });

  it('never sends external URLs to the Storage delete API', async () => {
    await service.removeByUrls([
      'https://attacker.example/storage/v1/object/public/event-gallery/event/file',
      `${SUPABASE_URL}/storage/v1/object/public/other-bucket/event/file`,
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bounds repeated upload timeouts', async () => {
    const timeout = Object.assign(new Error('private detail'), {
      name: 'TimeoutError',
    });
    fetchMock.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout);

    await expect(
      service.uploadForEvent([{ buffer: PNG }], EVENT_ID),
    ).rejects.toThrow(new BadGatewayException('หมดเวลารอจัดเก็บรูปภาพอีเวนต์'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
