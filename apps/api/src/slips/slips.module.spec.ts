import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ManualSlipVerifier } from './providers/manual-slip-verifier';
import { MockSlipVerifier } from './providers/mock-slip-verifier';
import { SlipVerificationService } from './slip-verification.service';
import { SLIP_VERIFIER } from './slip-verifier.interface';
import { SlipsModule } from './slips.module';
import type { SlipVerifier } from './slip-verifier.interface';

/**
 * Boots the real module against a controlled environment.
 *
 * `ignoreEnvFile` keeps .env out of it, and ConfigService reads `process.env`
 * ahead of anything else, so the variables are set there rather than through
 * `load()` — which ConfigService would lose to a value a teammate happened to
 * have exported.
 *
 * PrismaService is replaced before it is ever constructed: the real one is a
 * PrismaClient, and building one needs a DATABASE_URL that a unit test has no
 * business requiring. The module wiring is what is under test here.
 */
function bootSlipsModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PrismaModule,
      SlipsModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
}

/** The error a failed boot threw, or undefined if it booted after all. */
async function bootError(): Promise<unknown> {
  return bootSlipsModule().then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
}

describe('SlipsModule', () => {
  const original = {
    SLIP_VERIFIER: process.env.SLIP_VERIFIER,
    SLIP_VERIFIER_MODE: process.env.SLIP_VERIFIER_MODE,
  };

  afterEach(() => {
    // Restore rather than delete: whatever the developer had set is theirs.
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('binds MockSlipVerifier for SLIP_VERIFIER=mock', async () => {
    process.env.SLIP_VERIFIER = 'mock';

    const moduleRef = await bootSlipsModule();

    // `strict: false` because the token is deliberately not exported — see the
    // export test below. Reaching it here is the test looking inside the
    // module, not a pattern for a consumer to copy.
    expect(
      moduleRef.get<SlipVerifier>(SLIP_VERIFIER, { strict: false }),
    ).toBeInstanceOf(MockSlipVerifier);

    await moduleRef.close();
  });

  it('binds MockSlipVerifier when SLIP_VERIFIER is unset', async () => {
    delete process.env.SLIP_VERIFIER;

    const moduleRef = await bootSlipsModule();

    // The factory's own default. In production the Joi schema requires the
    // variable outright, so this default only ever applies in development.
    expect(
      moduleRef.get<SlipVerifier>(SLIP_VERIFIER, { strict: false }),
    ).toBeInstanceOf(MockSlipVerifier);

    await moduleRef.close();
  });

  it('binds ManualSlipVerifier for SLIP_VERIFIER=manual', async () => {
    process.env.SLIP_VERIFIER = 'manual';

    const moduleRef = await bootSlipsModule();

    expect(
      moduleRef.get<SlipVerifier>(SLIP_VERIFIER, { strict: false }),
    ).toBeInstanceOf(ManualSlipVerifier);

    await moduleRef.close();
  });

  // The one failure mode that must never be a silent fallback: a mock verifier
  // standing in for SlipOK approves every payment, so a deploy that asked for
  // the real thing and did not get it would confirm bookings nobody paid for.
  it('refuses to boot for SLIP_VERIFIER=slipok, naming the missing ticket', async () => {
    process.env.SLIP_VERIFIER = 'slipok';

    const error = await bootError();

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('not implemented yet');
    // Whoever hits this needs to know where the work lives, not just that it is
    // missing.
    expect(message).toContain('src/slips/providers/slipok-slip-verifier.ts');
    expect(message).toContain('src/slips/README.md');
    // And a way to keep working today.
    expect(message).toContain('SLIP_VERIFIER=mock');
    expect(message).toContain('SLIP_VERIFIER=manual');
  });

  it('refuses to boot for an unknown SLIP_VERIFIER value', async () => {
    process.env.SLIP_VERIFIER = 'nonsense';

    const error = await bootError();

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Unknown SLIP_VERIFIER');
  });

  // Symmetry with AiModule: the wrapper service is the public surface, the
  // token is not. A consumer that injected SLIP_VERIFIER directly would skip
  // the `verified_slip` write.
  it('exports SlipVerificationService and keeps the token internal', async () => {
    process.env.SLIP_VERIFIER = 'mock';

    const moduleRef = await bootSlipsModule();

    expect(
      moduleRef.get(SlipVerificationService, { strict: false }),
    ).toBeInstanceOf(SlipVerificationService);

    const exports: unknown[] =
      (Reflect.getMetadata('exports', SlipsModule) as unknown[]) ?? [];
    expect(exports).toContain(SlipVerificationService);
    expect(exports).not.toContain(SLIP_VERIFIER);

    await moduleRef.close();
  });
});
