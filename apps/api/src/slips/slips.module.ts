import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManualSlipVerifier } from './providers/manual-slip-verifier';
import { MockSlipVerifier } from './providers/mock-slip-verifier';
import { SlipOkSlipVerifier } from './providers/slipok-slip-verifier';
import { SlipVerificationService } from './slip-verification.service';
import { SLIP_VERIFIER } from './slip-verifier.interface';
import type { SlipVerifier } from './slip-verifier.interface';

type SlipVerifierName = 'mock' | 'manual' | 'slipok';

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
            return new SlipOkSlipVerifier(config);
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
