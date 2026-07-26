import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManualSlipVerifier } from './providers/manual-slip-verifier';
import { MockSlipVerifier } from './providers/mock-slip-verifier';
import { SlipVerificationService } from './slip-verification.service';
import { SLIP_VERIFIER } from './slip-verifier.interface';
import type { SlipVerifier } from './slip-verifier.interface';

/** Values accepted by SLIP_VERIFIER. */
type SlipVerifierName = 'mock' | 'manual' | 'slipok';

/**
 * Binds one implementation to the SLIP_VERIFIER token, chosen by the
 * SLIP_VERIFIER environment variable. Consumers never learn which one they got.
 *
 * The factory runs at boot, so an unusable configuration stops the server
 * immediately instead of failing on the first vendor who uploads a slip.
 *
 * Only `SlipVerificationService` is exported, the same arrangement AiModule
 * uses for `ZoneRecommendationService`. The token stays internal on purpose:
 * reaching past the service would skip the `verified_slip` write, and a
 * verification nobody recorded is one an ORG_ADMIN cannot review.
 */
@Module({
  providers: [
    {
      provide: SLIP_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SlipVerifier => {
        const name = config.get<SlipVerifierName>('SLIP_VERIFIER') ?? 'mock';

        switch (name) {
          case 'mock':
            return new MockSlipVerifier(config);

          case 'manual':
            return new ManualSlipVerifier();

          case 'slipok':
            // Deliberate: SLIP_VERIFIER=slipok must not silently fall back to a
            // mock that approves every payment.
            throw new Error(
              'SLIP_VERIFIER=slipok is not implemented yet. The real client ' +
                '(src/slips/providers/slipok-slip-verifier.ts) is a separate ' +
                'ticket — see src/slips/README.md. Use SLIP_VERIFIER=mock for ' +
                'local development or SLIP_VERIFIER=manual to fall back to ' +
                'ORG_ADMIN confirmation.',
            );

          default:
            throw new Error(
              `Unknown SLIP_VERIFIER "${String(name)}". Valid values: mock, ` +
                'manual, slipok.',
            );
        }
      },
    },
    SlipVerificationService,
  ],
  exports: [SlipVerificationService],
})
export class SlipsModule {}
