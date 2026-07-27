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
const INVALID_CODES = new Set([1005, 1006, 1007, 1008, 1011, 1013, 1014]);

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

    try {
      const response = await fetch(
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
            log: true,
            // SlipOK's wire contract requires a JSON number. This conversion is
            // deliberately confined to the external adapter.
            amount: input.expectedAmount.toNumber(),
          }),
          signal: controller.signal,
        },
      );

      const payload = await parsePayload(response);
      return mapResponse(response.ok, payload);
    } catch (error) {
      return {
        status: SlipStatus.ERROR,
        message:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'SlipOK request timed out'
            : 'SlipOK service is unavailable',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function parsePayload(response: Response): Promise<SlipOkResponse> {
  const value: unknown = await response.json();

  if (typeof value !== 'object' || value === null) {
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
  const message = text(payload.message) ?? 'SlipOK could not verify this slip';

  if (code === 1012) {
    // Do not copy the repeated transRef into this row: the original row owns
    // that unique value. The provider raw body remains available to admins.
    return {
      status: SlipStatus.DUPLICATE,
      raw: payload,
      message,
    };
  }

  if (code !== undefined && INVALID_CODES.has(code)) {
    return {
      status: SlipStatus.INVALID,
      raw: payload,
      message,
    };
  }

  // Authentication, quota, package, temporary bank delay, upstream failure,
  // and unknown codes are operational failures. A genuine slip must never be
  // labelled invalid merely because its verifier is unavailable.
  return {
    status: SlipStatus.ERROR,
    raw: payload,
    message,
  };
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
