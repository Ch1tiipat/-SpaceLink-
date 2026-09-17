import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma, RefundStatus, SlipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SLIP_VERIFIER } from './slip-verifier.interface';
import type { SlipVerifier } from './slip-verifier.interface';

const REFUND_PAYOUT_EVIDENCE_KIND = 'REFUND_PAYOUT_SLIP';

export interface RefundPayoutEvidence {
  kind: typeof REFUND_PAYOUT_EVIDENCE_KIND;
  version: 1;
  objectPath: string;
  transRef: string;
  amount: string;
  sendingBank: string | null;
  senderName: string | null;
  receiverName: string | null;
  verifiedAt: string;
  nameMismatchWarning: boolean;
}

export interface RefundPayoutVerificationRequest {
  refundId: string;
  expectedAmount: Prisma.Decimal;
  payoutAccountName: string | null;
  objectPath: string;
  slipImageUrl: string;
}

export interface RefundPayoutVerificationResponse {
  status: 'VERIFIED';
  amount: string;
  receiverName: string | null;
  verifiedAt: string;
  nameMismatchWarning: boolean;
}

/**
 * Verifies outgoing refund evidence without creating a VerifiedSlip row.
 * VerifiedSlip is payment-in evidence and is consumed by payment-state and
 * timeline derivation, so refund payout evidence belongs on RefundRequest.
 *
 * Known limitation: evidenceUrls has no database-unique transRef column. The
 * provider duplicate check plus the serializable cross-checks below reduce the
 * risk, but cannot make concurrent refund evidence globally unique without a
 * schema change. SCRUM-218 explicitly accepts that trade-off while the schema
 * remains frozen.
 */
@Injectable()
export class RefundSlipVerificationService {
  constructor(
    @Inject(SLIP_VERIFIER) private readonly verifier: SlipVerifier,
    private readonly prisma: PrismaService,
  ) {}

  async verifyAndStore(
    request: RefundPayoutVerificationRequest,
  ): Promise<RefundPayoutVerificationResponse> {
    const result = await this.verifier.verify({
      slipImageUrl: request.slipImageUrl,
      expectedAmount: request.expectedAmount,
    });

    if (result.status === SlipStatus.DUPLICATE) {
      throw new ConflictException('สลิปนี้เคยถูกใช้แล้ว');
    }
    if (result.status !== SlipStatus.VERIFIED) {
      throw new BadRequestException('SlipOK ไม่สามารถยืนยันสลิปคืนเงินนี้ได้');
    }
    if (!result.amount || !result.amount.equals(request.expectedAmount)) {
      throw new BadRequestException('ยอดในสลิปไม่ตรงกับยอดคืนเงินที่อนุมัติ');
    }
    if (!result.transRef) {
      throw new BadRequestException('สลิปคืนเงินไม่มีเลขอ้างอิงธุรกรรม');
    }

    const verifiedAt = new Date().toISOString();
    const nameMismatchWarning = !refundPayoutNamesMatch(
      result.receiverName,
      request.payoutAccountName,
    );
    const evidence: RefundPayoutEvidence = {
      kind: REFUND_PAYOUT_EVIDENCE_KIND,
      version: 1,
      objectPath: request.objectPath,
      transRef: result.transRef,
      amount: result.amount.toString(),
      sendingBank: result.sendingBank ?? null,
      senderName: result.senderName ?? null,
      receiverName: result.receiverName ?? null,
      verifiedAt,
      nameMismatchWarning,
    };

    await this.prisma.$transaction(
      async (transaction) => {
        const paymentSlip = await transaction.verifiedSlip.findUnique({
          where: { transRef: result.transRef },
          select: { id: true },
        });
        if (paymentSlip) {
          throw new ConflictException('สลิปนี้เคยถูกใช้แล้ว');
        }

        const duplicateRefund = await transaction.$queryRaw<{ id: string }[]>`
          SELECT refund_request_id AS id
          FROM refund_request
          WHERE evidence_urls ->> 'transRef' = ${result.transRef}
            AND refund_request_id <> ${request.refundId}::uuid
          LIMIT 1
        `;
        if (duplicateRefund.length > 0) {
          throw new ConflictException('สลิปนี้เคยถูกใช้แล้ว');
        }

        const updated = await transaction.refundRequest.updateMany({
          where: {
            id: request.refundId,
            status: RefundStatus.APPROVED,
            evidenceUrls: { equals: Prisma.DbNull },
          },
          data: { evidenceUrls: evidence as unknown as Prisma.InputJsonValue },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'คำร้องนี้มีหลักฐานแล้วหรือสถานะเปลี่ยนไปแล้ว',
          );
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      status: 'VERIFIED',
      amount: evidence.amount,
      receiverName: evidence.receiverName,
      verifiedAt,
      nameMismatchWarning,
    };
  }
}

export function parseRefundPayoutEvidence(
  value: unknown,
): RefundPayoutEvidence | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const evidence = value as Record<string, unknown>;
  if (
    evidence.kind !== REFUND_PAYOUT_EVIDENCE_KIND ||
    evidence.version !== 1 ||
    typeof evidence.objectPath !== 'string' ||
    typeof evidence.transRef !== 'string' ||
    typeof evidence.amount !== 'string' ||
    typeof evidence.verifiedAt !== 'string' ||
    typeof evidence.nameMismatchWarning !== 'boolean'
  ) {
    return null;
  }

  return evidence as unknown as RefundPayoutEvidence;
}

export function refundPayoutNamesMatch(
  receiverName: string | undefined,
  payoutAccountName: string | null,
): boolean {
  if (!receiverName || !payoutAccountName) return false;
  return normalizeName(receiverName) === normalizeName(payoutAccountName);
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/^(?:นาย|นางสาว|นาง|mr\.?|mrs\.?|ms\.?)\s*/iu, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('th');
}
