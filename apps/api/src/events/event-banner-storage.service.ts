import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const EVENT_BANNER_BUCKET = 'event-banners';
export const MAX_EVENT_BANNER_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_EVENT_BANNER_DIMENSION_PX = 2000;

const STORAGE_REQUEST_TIMEOUT_MS = 15_000;
const STORAGE_REQUEST_ATTEMPTS = 2;
const STORAGE_RETRY_DELAY_MS = 200;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface UploadedEventBannerFile {
  buffer: Buffer;
}

type ImageDimensions = { width: number; height: number };
type BannerContentType = 'image/jpeg' | 'image/png';

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.byteLength < 24 || buffer.toString('latin1', 12, 16) !== 'IHDR') {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 3 < buffer.byteLength) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) return null;

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 > buffer.byteLength) return null;
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

@Injectable()
export class EventBannerStorageService {
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

  async uploadForEvent(
    file: UploadedEventBannerFile,
    eventId: string,
  ): Promise<string> {
    const contentType = this.validateImage(file);
    const objectPath = `${eventId}/${randomUUID()}`;

    let response: Response;
    try {
      response = await this.request(this.objectUrl(objectPath), {
        method: 'POST',
        headers: this.headers({
          'Content-Type': contentType,
          'x-upsert': 'false',
        }),
        body: new Uint8Array(file.buffer),
      });
    } catch (error) {
      if (error instanceof StorageTimeoutError) {
        throw new BadGatewayException('หมดเวลารอจัดเก็บภาพปกอีเวนต์');
      }
      throw new BadGatewayException('ไม่สามารถจัดเก็บภาพปกอีเวนต์ได้');
    }
    if (!response.ok) {
      throw new BadGatewayException('ไม่สามารถจัดเก็บภาพปกอีเวนต์ได้');
    }

    return this.publicUrl(objectPath);
  }

  async removeByUrl(url: string): Promise<void> {
    const objectPath = this.objectPathFromPublicUrl(url);
    if (!objectPath) return;

    let response: Response;
    try {
      response = await this.request(
        `${this.supabaseUrl}/storage/v1/object/${EVENT_BANNER_BUCKET}`,
        {
          method: 'DELETE',
          headers: this.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ prefixes: [objectPath] }),
        },
      );
    } catch (error) {
      if (error instanceof StorageTimeoutError) {
        throw new BadGatewayException('หมดเวลารอลบภาพปกอีเวนต์');
      }
      throw new BadGatewayException('ไม่สามารถลบภาพปกอีเวนต์จากที่จัดเก็บได้');
    }
    if (!response.ok) {
      throw new BadGatewayException('ไม่สามารถลบภาพปกอีเวนต์จากที่จัดเก็บได้');
    }
  }

  private validateImage(file: UploadedEventBannerFile): BannerContentType {
    const size = file.buffer.byteLength;
    if (size === 0) {
      throw new BadRequestException('ไฟล์ภาพปกว่างเปล่า');
    }
    if (size > MAX_EVENT_BANNER_FILE_SIZE_BYTES) {
      throw new BadRequestException('ภาพปกต้องมีขนาดไม่เกิน 2 MB');
    }

    if (
      file.buffer[0] === 0xff &&
      file.buffer[1] === 0xd8 &&
      file.buffer[2] === 0xff
    ) {
      this.assertDimensions(readJpegDimensions(file.buffer));
      return 'image/jpeg';
    }
    if (PNG_SIGNATURE.every((byte, index) => file.buffer[index] === byte)) {
      this.assertDimensions(readPngDimensions(file.buffer));
      return 'image/png';
    }
    throw new BadRequestException('รองรับเฉพาะไฟล์ JPEG และ PNG');
  }

  private assertDimensions(dimensions: ImageDimensions | null): void {
    if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
      throw new BadRequestException('ไฟล์ภาพปกเสียหาย ไม่สามารถอ่านขนาดภาพได้');
    }
    if (
      dimensions.width > MAX_EVENT_BANNER_DIMENSION_PX ||
      dimensions.height > MAX_EVENT_BANNER_DIMENSION_PX
    ) {
      throw new BadRequestException(
        `ภาพปกต้องมีความกว้างและความสูงไม่เกิน ${MAX_EVENT_BANNER_DIMENSION_PX} พิกเซล`,
      );
    }
  }

  private publicUrl(objectPath: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${EVENT_BANNER_BUCKET}/${this.encodePath(objectPath)}`;
  }

  private objectUrl(objectPath: string): string {
    return `${this.supabaseUrl}/storage/v1/object/${EVENT_BANNER_BUCKET}/${this.encodePath(objectPath)}`;
  }

  private objectPathFromPublicUrl(value: string): string | null {
    try {
      const url = new URL(value);
      if (url.origin !== new URL(this.supabaseUrl).origin) return null;
      const prefix = `/storage/v1/object/public/${EVENT_BANNER_BUCKET}/`;
      if (!url.pathname.startsWith(prefix)) return null;
      const segments = url.pathname
        .slice(prefix.length)
        .split('/')
        .map(decodeURIComponent);
      if (
        segments.length !== 2 ||
        segments.some(
          (segment) =>
            !segment ||
            segment === '.' ||
            segment === '..' ||
            segment.includes('/') ||
            segment.includes('\\'),
        )
      ) {
        return null;
      }
      return segments.join('/');
    } catch {
      return null;
    }
  }

  private headers(extra: Record<string, string>): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      ...extra,
    };
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
