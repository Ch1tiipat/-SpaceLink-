import { Injectable, Logger } from '@nestjs/common';
import { SlipStatus } from '@prisma/client';
import type {
  SlipVerificationResult,
  SlipVerifier,
} from '../slip-verifier.interface';

/**
 * Fallback for when automatic verification is unavailable — SlipOK is down, the
 * free-tier quota is spent, or credentials have not been issued yet.
 *
 * It always returns ERROR, which under the booking flow (AGENTS.md §8 step 4)
 * leaves the booking at PENDING_PAYMENT rather than cancelling it. An ORG_ADMIN
 * then settles the booking by hand through the payment-exempt path (§8 step 6):
 * a CONFIRMED booking with `isPaymentExempt = true` and a reason.
 *
 * ERROR, not INVALID: the slip was never examined, so calling it invalid would
 * assert something untrue about the vendor's payment.
 */
@Injectable()
export class ManualSlipVerifier implements SlipVerifier {
  private readonly logger = new Logger(ManualSlipVerifier.name);

  verify(): Promise<SlipVerificationResult> {
    // No input is read and none is logged — a slip URL is a signed URL to a
    // private object (AGENTS.md §14.1).
    this.logger.warn(
      'Manual slip verification is active — this slip was not checked ' +
        'automatically and needs an ORG_ADMIN.',
    );

    return Promise.resolve({
      status: SlipStatus.ERROR,
      message:
        'ตรวจสอบสลิปอัตโนมัติไม่พร้อมใช้งาน — ผู้ดูแลองค์กร (ORG_ADMIN) ' +
        'ต้องตรวจสอบสลิปด้วยตนเอง แล้วยืนยันการจองผ่าน isPaymentExempt ' +
        'พร้อมระบุเหตุผล',
    });
  }
}
