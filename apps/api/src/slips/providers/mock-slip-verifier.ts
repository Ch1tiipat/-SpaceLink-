import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlipStatus } from '@prisma/client';
import type {
  SlipVerificationInput,
  SlipVerificationResult,
  SlipVerifier,
} from '../slip-verifier.interface';

/** Values accepted by SLIP_VERIFIER_MODE. */
export type MockSlipVerifierMode = 'always-verified' | 'always-invalid';

/**
 * Development stand-in for SlipOK. Verifies nothing — it reads no image and
 * makes no network call, it just returns whichever fixed outcome
 * SLIP_VERIFIER_MODE asks for.
 *
 * It exists so the booking flow (AGENTS.md §8) can be built and demoed before
 * anyone has SlipOK credentials. Every call logs a warning so a mock left
 * enabled by accident is loud rather than silent.
 */
@Injectable()
export class MockSlipVerifier implements SlipVerifier {
  private readonly logger = new Logger(MockSlipVerifier.name);
  private readonly mode: MockSlipVerifierMode;

  constructor(config: ConfigService) {
    this.mode =
      config.get<MockSlipVerifierMode>('SLIP_VERIFIER_MODE') ??
      'always-verified';
  }

  verify(input: SlipVerificationInput): Promise<SlipVerificationResult> {
    // Warn on every call, not once at boot: a single startup line scrolls away,
    // and "the slip was approved" is exactly the claim that must not be
    // mistaken for a real one.
    this.logger.warn(
      `MOCK slip verification (mode=${this.mode}) — no slip was actually ` +
        'checked and no bank was contacted. Set SLIP_VERIFIER=slipok for real ' +
        'verification.',
    );

    if (this.mode === 'always-invalid') {
      return Promise.resolve({
        status: SlipStatus.INVALID,
        message: 'Mock verifier: SLIP_VERIFIER_MODE=always-invalid.',
      });
    }

    return Promise.resolve({
      status: SlipStatus.VERIFIED,
      // `trans_ref` is unique in the database (§6.3.7), so a fixed string would
      // make the second mock booking fail on a constraint violation.
      transRef: `MOCK-${randomUUID().replace(/-/g, '').toUpperCase()}`,
      // Handed back exactly as it came in — the same Decimal instance, not a
      // rebuilt value — so the caller's exact-equality check (§6.3.7) is
      // testing the booking flow rather than this mock's arithmetic.
      amount: input.expectedAmount,
      message: 'Mock verifier: SLIP_VERIFIER_MODE=always-verified.',
    });
  }
}
