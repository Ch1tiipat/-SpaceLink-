import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MAX_SHOP_LOGO_DIMENSION_PX,
  MAX_SHOP_LOGO_FILE_SIZE_BYTES,
  ShopLogoStorageService,
} from './shop-logo-storage.service';

const SUPABASE_URL = 'https://project.supabase.co';
const SERVICE_ROLE_KEY = 'test-service-role-key';
const SHOP_ID = '22222222-2222-4222-8222-222222222222';

/** Signature, IHDR chunk length, the tag, then width and height. */
function pngOf(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

/**
 * SOI, then an APP0 segment the parser has to skip over, then SOF0 — the
 * dimensions are not at a fixed offset in this format, so the fixture includes
 * something to walk past.
 */
function jpegOf(width: number, height: number): Buffer {
  const buffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
    0x08, 0x00, 0x00, 0x00, 0x00,
  ]);
  buffer.writeUInt16BE(height, 13);
  buffer.writeUInt16BE(width, 15);
  return buffer;
}

const PNG = pngOf(512, 512);
const JPEG = jpegOf(512, 512);

describe('ShopLogoStorageService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let service: ShopLogoStorageService;

  beforeEach(() => {
    const values: Record<string, string> = {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    };
    const getOrThrow = jest.fn((key: string): string => values[key]);
    const config = { getOrThrow } as unknown as ConfigService;

    fetchMock = jest.spyOn(globalThis, 'fetch');
    service = new ShopLogoStorageService(config);
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.restoreAllMocks();
  });

  it.each([
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
  ])(
    'uploads a real %s signature to one extension-less path per shop',
    async (_label, buffer, contentType) => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

      await service.uploadForShop({ buffer }, SHOP_ID);

      const [uploadUrl, uploadInit] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(uploadUrl).toBe(
        `${SUPABASE_URL}/storage/v1/object/shop-logos/${SHOP_ID}/logo`,
      );
      expect(uploadInit).toMatchObject({
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': contentType,
        },
      });
    },
  );

  /*
   * The slip bucket sends `x-upsert: false` so a second slip can never replace
   * the first. A logo is the opposite: overwriting in place is what keeps the
   * bucket free of orphaned files when a vendor swaps a JPEG for a PNG.
   */
  it('overwrites the existing object instead of rejecting a second upload', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await service.uploadForShop({ buffer: PNG }, SHOP_ID);

    const [, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadInit.headers).toMatchObject({ 'x-upsert': 'true' });
  });

  it('returns a public URL — no signing request is made', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_760_000_000_000);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const logoUrl = await service.uploadForShop({ buffer: PNG }, SHOP_ID);

    expect(logoUrl).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/shop-logos/${SHOP_ID}/logo?v=1760000000000`,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /*
   * Supabase caches public objects for an hour and upsert leaves the path
   * identical, so without the `v` parameter a replaced logo would keep serving
   * the old bytes on the zone map. This is the whole reason it is there.
   */
  it('gives each upload a distinct URL even though the object path is reused', async () => {
    const now = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_760_000_000_000)
      .mockReturnValueOnce(1_760_000_060_000);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const first = await service.uploadForShop({ buffer: PNG }, SHOP_ID);
    const second = await service.uploadForShop({ buffer: JPEG }, SHOP_ID);

    expect(first).not.toBe(second);
    expect(first.split('?')[0]).toBe(second.split('?')[0]);
    expect(now).toHaveBeenCalledTimes(2);
  });

  it('encodes each path segment', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_760_000_000_000);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const logoUrl = await service.uploadForShop({ buffer: PNG }, 'shop id');

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${SUPABASE_URL}/storage/v1/object/shop-logos/shop%20id/logo`,
    );
    expect(logoUrl).toContain('/public/shop-logos/shop%20id/logo?v=');
  });

  it('rejects content whose bytes are not JPEG or PNG', async () => {
    await expect(
      service.uploadForShop({ buffer: Buffer.from('not an image') }, SHOP_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty file', async () => {
    await expect(
      service.uploadForShop({ buffer: Buffer.alloc(0) }, SHOP_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a file larger than two megabytes', async () => {
    const oversized = Buffer.alloc(MAX_SHOP_LOGO_FILE_SIZE_BYTES + 1);
    oversized.set(PNG);

    await expect(
      service.uploadForShop({ buffer: oversized }, SHOP_ID),
    ).rejects.toThrow(
      new BadRequestException('ไฟล์โลโก้ต้องมีขนาดไม่เกิน 2 MB'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /*
   * The pixel limit is not implied by the byte limit: both fixtures below are a
   * few dozen bytes and would sail past the size check, and a real photograph
   * compresses to well under 2 MB at dimensions that still cost a phone 64 MP
   * to decode.
   */
  it.each([
    ['PNG', pngOf(MAX_SHOP_LOGO_DIMENSION_PX + 1, 400)],
    ['PNG', pngOf(400, MAX_SHOP_LOGO_DIMENSION_PX + 1)],
    ['JPEG', jpegOf(MAX_SHOP_LOGO_DIMENSION_PX + 1, 400)],
    ['JPEG', jpegOf(400, MAX_SHOP_LOGO_DIMENSION_PX + 1)],
  ])('rejects a %s past the pixel limit on either axis', async (_l, buffer) => {
    await expect(service.uploadForShop({ buffer }, SHOP_ID)).rejects.toThrow(
      new BadRequestException(
        `รูปโลโก้ต้องมีความกว้างและความสูงไม่เกิน ${MAX_SHOP_LOGO_DIMENSION_PX} พิกเซล`,
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['PNG', pngOf(MAX_SHOP_LOGO_DIMENSION_PX, MAX_SHOP_LOGO_DIMENSION_PX)],
    ['JPEG', jpegOf(MAX_SHOP_LOGO_DIMENSION_PX, MAX_SHOP_LOGO_DIMENSION_PX)],
  ])('accepts a %s exactly at the pixel limit', async (_l, buffer) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(service.uploadForShop({ buffer }, SHOP_ID)).resolves.toContain(
      '/public/shop-logos/',
    );
  });

  /*
   * Fail closed. The signature already claimed PNG or JPEG, so a header that
   * cannot be parsed is malformed — accepting it would leave the pixel limit
   * skippable by anyone willing to send a truncated file.
   */
  it.each([
    [
      'a PNG with no IHDR chunk',
      Buffer.concat([PNG.subarray(0, 12), Buffer.alloc(12)]),
    ],
    ['a truncated PNG header', PNG.subarray(0, 20)],
    [
      'a JPEG with no start-of-frame segment',
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    ],
    [
      'a JPEG whose scan begins before any frame header',
      Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x04, 0x00, 0x00]),
    ],
  ])('rejects %s rather than skipping the pixel check', async (_l, buffer) => {
    await expect(service.uploadForShop({ buffer }, SHOP_ID)).rejects.toThrow(
      new BadRequestException('ไฟล์รูปภาพเสียหาย ไม่สามารถอ่านขนาดภาพได้'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a zero-dimension image', async () => {
    await expect(
      service.uploadForShop({ buffer: pngOf(0, 400) }, SHOP_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a safe error when storage upload fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(
      service.uploadForShop({ buffer: PNG }, SHOP_ID),
    ).rejects.toThrow('ไม่สามารถจัดเก็บโลโก้ร้านได้');
  });

  it('bounds repeated storage timeouts without leaking the cause', async () => {
    const timeout = Object.assign(new Error('private timeout detail'), {
      name: 'TimeoutError',
    });
    fetchMock.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout);

    await expect(
      service.uploadForShop({ buffer: PNG }, SHOP_ID),
    ).rejects.toThrow(new BadGatewayException('หมดเวลารอจัดเก็บโลโก้ร้าน'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
