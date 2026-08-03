import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const PAYMENT_SLIP_BUCKET = 'slips';
export const MAX_SLIP_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const SIGNED_URL_TTL_SECONDS = 5 * 60;
const STORAGE_REQUEST_TIMEOUT_MS = 15_000;
const STORAGE_REQUEST_ATTEMPTS = 2;
const STORAGE_RETRY_DELAY_MS = 200;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface UploadedSlipFile {
  buffer: Buffer;
}

export interface StoredSlipUpload {
  objectPath: string;
  verificationUrl: string;
}

interface ValidatedSlipImage {
  contentType: 'image/jpeg' | 'image/png';
  extension: 'jpg' | 'png';
}

class StorageTimeoutError extends Error {}

/**
 * Stores payment slips without exposing the service-role key or a public URL.
 * The bucket must already exist and remain private; this service never creates
 * or changes bucket policy.
 */
@Injectable()
export class BookingSlipStorageService {
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

  async uploadForVerification(
    file: UploadedSlipFile,
    bookingId: string,
    vendorUserId: string,
  ): Promise<StoredSlipUpload> {
    const image = this.validateImage(file);
    const objectPath = `${vendorUserId}/${bookingId}/${randomUUID()}.${image.extension}`;

    try {
      await this.uploadObject(objectPath, file.buffer, image.contentType);
      const verificationUrl = await this.createSignedUrl(objectPath);
      return { objectPath, verificationUrl };
    } catch (error) {
      await this.removeObject(objectPath).catch(() => undefined);
      throw error;
    }
  }

  async removeObject(objectPath: string): Promise<void> {
    let response: Response;
    try {
      response = await this.request(this.objectUrl(objectPath), {
        method: 'DELETE',
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
        },
      });
    } catch (error) {
      if (error instanceof StorageTimeoutError) {
        throw new BadGatewayException('หมดเวลารอลบไฟล์สลิปที่ไม่สมบูรณ์');
      }
      throw new BadGatewayException('ไม่สามารถลบไฟล์สลิปที่ไม่สมบูรณ์ได้');
    }

    if (!response.ok && response.status !== 404) {
      throw new BadGatewayException('ไม่สามารถลบไฟล์สลิปที่ไม่สมบูรณ์ได้');
    }
  }

  private validateImage(file: UploadedSlipFile): ValidatedSlipImage {
    const size = file.buffer.byteLength;
    if (size === 0) {
      throw new BadRequestException('ไฟล์สลิปว่างเปล่า');
    }
    if (size > MAX_SLIP_FILE_SIZE_BYTES) {
      throw new BadRequestException('ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB');
    }

    if (
      file.buffer[0] === 0xff &&
      file.buffer[1] === 0xd8 &&
      file.buffer[2] === 0xff
    ) {
      return { contentType: 'image/jpeg', extension: 'jpg' };
    }

    const isPng = PNG_SIGNATURE.every(
      (byte, index) => file.buffer[index] === byte,
    );
    if (isPng) {
      return { contentType: 'image/png', extension: 'png' };
    }

    throw new BadRequestException('รองรับเฉพาะไฟล์ JPEG และ PNG');
  }

  private async uploadObject(
    objectPath: string,
    body: Buffer,
    contentType: ValidatedSlipImage['contentType'],
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.request(this.objectUrl(objectPath), {
        method: 'POST',
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
        body: new Uint8Array(body),
      });
    } catch (error) {
      if (error instanceof StorageTimeoutError) {
        throw new BadGatewayException('หมดเวลารอจัดเก็บสลิป');
      }
      throw new BadGatewayException('ไม่สามารถจัดเก็บสลิปได้');
    }

    if (!response.ok) {
      throw new BadGatewayException('ไม่สามารถจัดเก็บสลิปได้');
    }
  }

  private async createSignedUrl(objectPath: string): Promise<string> {
    let response: Response;
    try {
      response = await this.request(this.signUrl(objectPath), {
        method: 'POST',
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
      });
    } catch (error) {
      if (error instanceof StorageTimeoutError) {
        throw new BadGatewayException('หมดเวลารอสร้างลิงก์ตรวจสอบสลิป');
      }
      throw new BadGatewayException('ไม่สามารถสร้างลิงก์ตรวจสอบสลิปได้');
    }

    if (!response.ok) {
      throw new BadGatewayException('ไม่สามารถสร้างลิงก์ตรวจสอบสลิปได้');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException('ไม่สามารถสร้างลิงก์ตรวจสอบสลิปได้');
    }

    const signedUrl = this.readSignedUrl(payload);
    if (!signedUrl) {
      throw new BadGatewayException('ไม่สามารถสร้างลิงก์ตรวจสอบสลิปได้');
    }

    const storagePath = signedUrl.startsWith('/storage/v1/')
      ? signedUrl
      : `/storage/v1/${signedUrl.replace(/^\/+/, '')}`;
    const verificationUrl = new URL(storagePath, this.supabaseUrl);
    if (verificationUrl.origin !== new URL(this.supabaseUrl).origin) {
      throw new BadGatewayException('ไม่สามารถสร้างลิงก์ตรวจสอบสลิปได้');
    }
    return verificationUrl.toString();
  }

  private readSignedUrl(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const value = record.signedURL ?? record.signedUrl;
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private objectUrl(objectPath: string): string {
    return `${this.supabaseUrl}/storage/v1/object/${PAYMENT_SLIP_BUCKET}/${this.encodePath(objectPath)}`;
  }

  private signUrl(objectPath: string): string {
    return `${this.supabaseUrl}/storage/v1/object/sign/${PAYMENT_SLIP_BUCKET}/${this.encodePath(objectPath)}`;
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
