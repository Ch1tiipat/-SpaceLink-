import { setTimeout as delay } from 'node:timers/promises';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const SHOP_LOGO_BUCKET = 'shop-logos';
export const MAX_SHOP_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Pixel ceiling, checked in addition to the byte ceiling above. The two catch
 * different files: a heavily compressed 8000x8000 JPEG can sit well under 2 MB
 * and still cost every phone that renders the zone map the memory to decode 64
 * megapixels, since `zone-map.tsx` draws the logo into a booth rect a few dozen
 * pixels wide with no server-side resize in between.
 */
export const MAX_SHOP_LOGO_DIMENSION_PX = 2000;

const STORAGE_REQUEST_TIMEOUT_MS = 15_000;
const STORAGE_REQUEST_ATTEMPTS = 2;
const STORAGE_RETRY_DELAY_MS = 200;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface UploadedShopLogoFile {
  buffer: Buffer;
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface ValidatedLogoImage {
  contentType: 'image/jpeg' | 'image/png';
}

/**
 * Width and height out of the PNG IHDR chunk, which the format fixes in place:
 * an 8-byte signature, a 4-byte chunk length, the `IHDR` tag, then the two
 * dimensions as big-endian uint32s.
 */
function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.byteLength < 24) {
    return null;
  }
  if (buffer.toString('latin1', 12, 16) !== 'IHDR') {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * JPEG has no fixed header offset — the dimensions live in whichever
 * start-of-frame segment comes first, after any number of metadata segments of
 * arbitrary length. So walk the segment chain: each is `0xFF`, a marker byte,
 * then its own big-endian length.
 */
function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  // Byte 0-1 is the SOI marker, already matched by the signature check.
  let offset = 2;

  while (offset + 3 < buffer.byteLength) {
    if (buffer[offset] !== 0xff) {
      return null;
    }

    const marker = buffer[offset + 1];
    // A marker may be padded with any number of extra 0xFF fill bytes.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // TEM and RSTn/SOI/EOI carry no length field of their own.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    // Scan data starts here and is not length-delimited. If no frame header
    // turned up before it, there is nothing left to read.
    if (marker === 0xda) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      return null;
    }

    // SOF0-SOF15, minus the three that are not frame headers (DHT, JPGn, DAC).
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      // Marker, length, sample precision, then height before width.
      if (offset + 9 > buffer.byteLength) {
        return null;
      }
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

class StorageTimeoutError extends Error {}

/**
 * Stores shop logos in a **public** bucket, unlike BookingSlipStorageService,
 * whose bucket is private because a slip is financial evidence (§14.1). A logo
 * is published deliberately: `zone-map.tsx` puts it straight into an SVG
 * `<image href>` with no fetch and no Authorization header, so it has to be
 * readable without a token.
 *
 * That difference is why this service returns a finished public URL rather than
 * an object path — the value is stored verbatim in `shop.logoUrl` and every
 * read path (ShopsService, /auth/me, zone-map) already passes it through
 * untouched.
 *
 * The bucket must already exist and be public; this service never creates one
 * or changes bucket policy.
 */
@Injectable()
export class ShopLogoStorageService {
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;

  constructor(config: ConfigService) {
    this.supabaseUrl = config
      .getOrThrow<string>('SUPABASE_URL')
      .replace(/\/+$/, '');
    this.serviceRoleKey = config.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  /**
   * One object per shop, overwritten in place: the path carries no random part
   * and no file extension, so replacing a JPEG with a PNG reuses the same
   * object instead of orphaning the old one. The Content-Type header, not the
   * name, is what tells the browser how to render it.
   */
  async uploadForShop(
    file: UploadedShopLogoFile,
    shopId: string,
  ): Promise<string> {
    const image = this.validateImage(file);
    const objectPath = `${shopId}/logo`;

    await this.uploadObject(objectPath, file.buffer, image.contentType);
    return this.publicUrl(objectPath);
  }

  /**
   * The `v` parameter is what makes a re-upload visible. Supabase serves public
   * objects with a one-hour `Cache-Control`, and overwriting in place leaves the
   * URL identical — so without it a vendor who replaced their logo would keep
   * seeing the old one on the zone map until the CDN entry expired. Storage
   * ignores unknown query parameters, so the object still resolves.
   */
  private publicUrl(objectPath: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${SHOP_LOGO_BUCKET}/${this.encodePath(objectPath)}?v=${Date.now()}`;
  }

  /**
   * Magic bytes, not the client's `Content-Type` or filename (§14.4). Same two
   * formats the slip upload accepts, at a smaller ceiling — a logo is a small
   * square, not a screenshot of a banking app.
   *
   * Dimensions are read from the same bytes rather than trusted from the form,
   * for the reason on MAX_SHOP_LOGO_DIMENSION_PX. A file whose header cannot be
   * parsed is rejected rather than waved through: the signature already said it
   * claims to be a PNG or a JPEG, so an unreadable header means it is malformed,
   * and letting it past would make the pixel limit trivially skippable.
   */
  private validateImage(file: UploadedShopLogoFile): ValidatedLogoImage {
    const size = file.buffer.byteLength;
    if (size === 0) {
      throw new BadRequestException('ไฟล์โลโก้ว่างเปล่า');
    }
    if (size > MAX_SHOP_LOGO_FILE_SIZE_BYTES) {
      throw new BadRequestException('ไฟล์โลโก้ต้องมีขนาดไม่เกิน 2 MB');
    }

    if (
      file.buffer[0] === 0xff &&
      file.buffer[1] === 0xd8 &&
      file.buffer[2] === 0xff
    ) {
      this.assertDimensions(readJpegDimensions(file.buffer));
      return { contentType: 'image/jpeg' };
    }

    const isPng = PNG_SIGNATURE.every(
      (byte, index) => file.buffer[index] === byte,
    );
    if (isPng) {
      this.assertDimensions(readPngDimensions(file.buffer));
      return { contentType: 'image/png' };
    }

    throw new BadRequestException('รองรับเฉพาะไฟล์ JPEG และ PNG');
  }

  private assertDimensions(dimensions: ImageDimensions | null): void {
    if (
      !dimensions ||
      dimensions.width === 0 ||
      dimensions.height === 0 ||
      !Number.isFinite(dimensions.width) ||
      !Number.isFinite(dimensions.height)
    ) {
      throw new BadRequestException(
        'ไฟล์รูปภาพเสียหาย ไม่สามารถอ่านขนาดภาพได้',
      );
    }

    if (
      dimensions.width > MAX_SHOP_LOGO_DIMENSION_PX ||
      dimensions.height > MAX_SHOP_LOGO_DIMENSION_PX
    ) {
      throw new BadRequestException(
        `รูปโลโก้ต้องมีความกว้างและความสูงไม่เกิน ${MAX_SHOP_LOGO_DIMENSION_PX} พิกเซล`,
      );
    }
  }

  private async uploadObject(
    objectPath: string,
    body: Buffer,
    contentType: ValidatedLogoImage['contentType'],
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.request(this.objectUrl(objectPath), {
        method: 'POST',
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(body),
      });
    } catch (error) {
      if (error instanceof StorageTimeoutError) {
        throw new BadGatewayException('หมดเวลารอจัดเก็บโลโก้ร้าน');
      }
      throw new BadGatewayException('ไม่สามารถจัดเก็บโลโก้ร้านได้');
    }

    if (!response.ok) {
      throw new BadGatewayException('ไม่สามารถจัดเก็บโลโก้ร้านได้');
    }
  }

  private objectUrl(objectPath: string): string {
    return `${this.supabaseUrl}/storage/v1/object/${SHOP_LOGO_BUCKET}/${this.encodePath(objectPath)}`;
  }

  private encodePath(objectPath: string): string {
    return objectPath.split('/').map(encodeURIComponent).join('/');
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= STORAGE_REQUEST_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(STORAGE_REQUEST_TIMEOUT_MS),
        });
        if (response.status < 500 || attempt === STORAGE_REQUEST_ATTEMPTS) {
          return response;
        }
      } catch (error) {
        lastError = error;
        if (attempt === STORAGE_REQUEST_ATTEMPTS) {
          if (
            error instanceof Error &&
            (error.name === 'TimeoutError' || error.name === 'AbortError')
          ) {
            throw new StorageTimeoutError();
          }
          throw error;
        }
      }

      await delay(STORAGE_RETRY_DELAY_MS * attempt);
    }

    throw lastError instanceof Error ? lastError : new Error('Storage failed');
  }
}
