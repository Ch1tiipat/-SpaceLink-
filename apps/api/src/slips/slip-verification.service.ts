import { Inject, Injectable } from '@nestjs/common';
import { Prisma, SlipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SLIP_VERIFIER } from './slip-verifier.interface';
import type {
  SlipVerificationInput,
  SlipVerificationResult,
  SlipVerifier,
} from './slip-verifier.interface';

/**
 * What this service is asked to verify: the provider's input plus the booking
 * the slip belongs to. `verified_slip.booking_id` is required and the verifier
 * contract has no reason to know about bookings, so the id is added here rather
 * than pushed down into `SlipVerificationInput`.
 */
export interface SlipVerificationRequest extends SlipVerificationInput {
  /** `booking.id`. Becomes `verifiedSlip.bookingId`. */
  bookingId: string;
}

/**
 * The entry point calling services use. **Inject this, not `SLIP_VERIFIER`.**
 * The token stays internal to SlipsModule so every verification leaves a row
 * behind, exactly as `ZoneRecommendationService` owns `ZONE_RECOMMENDER`.
 *
 * ## Scope boundary — do not grow this class
 *
 * It owns exactly two things: **calling the configured verifier** and
 * **persisting the `verified_slip` row**. Everything below is booking logic and
 * belongs to the booking service in a later ticket:
 *
 * - **It does not change booking status.** Auto-confirming a VERIFIED slip
 *   (AGENTS.md §8 step 3) is the booking service's decision, together with
 *   `confirmedAt` and the hold.
 * - **It does not enforce invariant §6.3.7** (`verified_slip.amount` equals
 *   `booking.boothPrice`). It records what the provider read; comparing that to
 *   the booth price — with `.equals()`, never `===` — is the booking service's
 *   check, and the row written here is the evidence it reads.
 * - **It does not enforce `trans_ref` uniqueness.** The column is unique in the
 *   schema, so a duplicate surfaces as a Prisma P2002 that the booking service
 *   turns into `SlipStatus.DUPLICATE`.
 *
 * Adding any of the three here would split one decision across two services and
 * make the slip record depend on booking state it cannot see.
 */
@Injectable()
export class SlipVerificationService {
  constructor(
    @Inject(SLIP_VERIFIER) private readonly verifier: SlipVerifier,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Calls the verifier, writes one `verified_slip` row from the result, and
   * hands the result straight back to the caller.
   *
   * The row is written for **every** outcome, not just VERIFIED. A failed or
   * errored check is the thing an ORG_ADMIN needs to see when a vendor says
   * they paid — dropping it would make a failure invisible and leave the
   * payment-exempt path (§8 step 6) to be taken on a vendor's word alone.
   *
   * Nothing here is logged: the result carries `senderName`, `sendingBank` and
   * the provider's `raw` body, none of which may reach a log line (§14.1).
   */
  async verify(
    request: SlipVerificationRequest,
  ): Promise<SlipVerificationResult> {
    const result = await this.verifier.verify({
      slipImageUrl: request.slipImageUrl,
      expectedAmount: request.expectedAmount,
    });

    await this.prisma.verifiedSlip.create({
      data: {
        bookingId: request.bookingId,
        slipImageUrl: request.slipImageUrl,
        slipokStatus: result.status,
        // `amount` is NOT NULL, but a non-VERIFIED result read no amount off the
        // slip. Zero, never `expectedAmount`: filling the column with the price
        // we were hoping to see would make a slip that was never read satisfy
        // the equality check in §6.3.7.
        amount: result.amount ?? new Prisma.Decimal(0),
        transRef: result.transRef,
        sendingBank: result.sendingBank,
        senderName: result.senderName,
        receiverName: result.receiverName,
        slipokRaw:
          result.raw === undefined
            ? undefined
            : (result.raw as Prisma.InputJsonValue),
        // Only a VERIFIED slip was actually verified; on any other status the
        // column stays NULL rather than recording the time we gave up.
        verifiedAt: result.status === SlipStatus.VERIFIED ? new Date() : null,
      },
    });

    // `result.message` has no column on purpose — it is an explanation for an
    // admin reading this response, not a fact about the slip.
    return result;
  }
}
