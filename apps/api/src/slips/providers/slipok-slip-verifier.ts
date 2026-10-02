import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SlipStatus } from '@prisma/client';
import type {
  SlipVerificationInput,
  SlipVerificationResult,
  SlipVerifier,
} from '../slip-verifier.interface';

const SLIPOK_API_BASE_URL = 'https://api.slipok.com/api/line/apikey';
const REQUEST_TIMEOUT_MS = 8000;
// Provider messages may contain transaction details. Only these fixed
// explanations may cross the verifier boundary into an admin-facing response.
const INVALID_CODE_MESSAGES = new Map<number, string>([
  [1005, 'ไฟล์สลิปต้องเป็นภาพที่รองรับ'],
  [1006, 'ภาพสลิปไม่ชัดเจนหรือไม่ถูกต้อง'],
  [1007, 'ไม่พบ QR Code ในภาพสลิป'],
  [1008, 'QR Code ในสลิปไม่ถูกต้อง'],
  [1011, 'QR Code ในสลิปหมดอายุหรือไม่พบรายการ'],
  [1013, 'ยอดในสลิปไม่ตรงกับยอดคืนเงินที่อนุมัติ'],
  [1014, 'บัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีที่กำหนด'],
]);

type SlipOkParty = {
  displayName?: unknown;
  name?: unknown;
};

type SlipOkData = {
  success?: unknown;
  message?: unknown;
  transRef?: unknown;
  sendingBank?: unknown;
  amount?: unknown;
  sender?: SlipOkParty;
  receiver?: SlipOkParty;
};

type SlipOkResponse = {
  success?: unknown;
  code?: unknown;
  message?: unknown;
  data?: SlipOkData;
};

/**
 * SlipOK adapter. It owns every wire-format conversion so the internal
 * contract remains Decimal-only and provider-agnostic.
 */
@Injectable()
export class SlipOkSlipVerifier implements SlipVerifier {
  private readonly branchId: string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.branchId = required(config, 'SLIPOK_BRANCH_ID');
    this.apiKey = required(config, 'SLIPOK_API_KEY');
  }

  async verify(input: SlipVerificationInput): Promise<SlipVerificationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(
        `${SLIPOK_API_BASE_URL}/${encodeURIComponent(this.branchId)}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-authorization': this.apiKey,
          },
          body: JSON.stringify({
            url: input.slipImageUrl,
            // `log: true` asks SlipOK to compare the receiver with the
            // merchant account linked to the branch. That is correct for
            // incoming payments, but an outgoing refund intentionally names
            // the vendor as receiver. Refund duplicate protection remains in
            // RefundSlipVerificationService through its transRef checks.
            log: input.purpose !== 'REFUND_PAYOUT',
            // SlipOK's wire contract requires a JSON number. This conversion is
            // deliberately confined to the external adapter.
            amount: input.expectedAmount.toNumber(),
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      throw new Error(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'SlipOK request timed out'
          : 'SlipOK service is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = await parsePayload(response);
    return mapResponse(response.ok, payload);
  }
}

async function parsePayload(response: Response): Promise<SlipOkResponse> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    // Do not forward the parser error or upstream response body. Either can
    // contain provider diagnostics that are not safe for a client-facing
    // error, while the caller only needs to know that the provider response
    // could not be trusted.
    throw new Error('SlipOK returned invalid JSON');
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('SlipOK returned a malformed response');
  }

  return value;
}

function mapResponse(
  responseOk: boolean,
  payload: SlipOkResponse,
): SlipVerificationResult {
  if (
    responseOk &&
    payload.success === true &&
    payload.data?.success === true
  ) {
    const data = payload.data;
    const amount = decimal(data.amount);
    const transRef = text(data.transRef);

    if (!amount || !transRef) {
      return {
        status: SlipStatus.ERROR,
        raw: payload,
        message: 'SlipOK response is missing transaction details',
      };
    }

    return {
      status: SlipStatus.VERIFIED,
      transRef,
      amount,
      sendingBank: text(data.sendingBank),
      senderName: partyName(data.sender),
      receiverName: partyName(data.receiver),
      raw: payload,
      message: text(data.message),
    };
  }

  const code = integer(payload.code);
  if (code === 1012) {
    // Do not copy the repeated transRef into this row: the original row owns
    // that unique value. The provider raw body remains available to admins.
    return {
      status: SlipStatus.DUPLICATE,
      raw: payload,
      message: 'สลิปนี้เคยถูกใช้แล้ว',
    };
  }

  const invalidMessage =
    code === undefined ? undefined : INVALID_CODE_MESSAGES.get(code);
  if (invalidMessage) {
    return {
      status: SlipStatus.INVALID,
      raw: payload,
      message: invalidMessage,
    };
  }

  // Authentication, quota, package, temporary bank delay, upstream failure,
  // and unknown codes are operational failures rather than slip facts. Let the
  // wrapper/caller decide whether to retry or use a fallback; a pure provider
  // must not turn an unavailable upstream into a persisted slip outcome.
  throw new Error(
    code === undefined
      ? `SlipOK request failed with HTTP status`
      : `SlipOK request failed with provider code ${code}`,
  );
}

function required(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) {
    throw new Error(`${key} is required when SLIP_VERIFIER=slipok`);
  }
  return value;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function integer(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value)
    ? value
    : undefined;
}

function decimal(value: unknown): Prisma.Decimal | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined;
  }

  try {
    return new Prisma.Decimal(String(value));
  } catch {
    return undefined;
  }
}

function partyName(party: SlipOkParty | undefined): string | undefined {
  return text(party?.displayName) ?? text(party?.name);
}
