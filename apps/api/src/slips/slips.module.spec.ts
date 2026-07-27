import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ManualSlipVerifier } from './providers/manual-slip-verifier';
import { MockSlipVerifier } from './providers/mock-slip-verifier';
import { SlipOkSlipVerifier } from './providers/slipok-slip-verifier';
import { SlipVerificationService } from './slip-verification.service';
import { SLIP_VERIFIER } from './slip-verifier.interface';
import { SlipsModule } from './slips.module';
import type { SlipVerifier } from './slip-verifier.interface';

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

describe('SlipsModule', () => {
  const original = {
    SLIP_VERIFIER: process.env.SLIP_VERIFIER,
    SLIP_VERIFIER_MODE: process.env.SLIP_VERIFIER_MODE,
    SLIPOK_BRANCH_ID: process.env.SLIPOK_BRANCH_ID,
    SLIPOK_API_KEY: process.env.SLIPOK_API_KEY,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it.each([
    ['mock', MockSlipVerifier],
    ['manual', ManualSlipVerifier],
  ])('binds %s verifier', async (name, expected) => {
    process.env.SLIP_VERIFIER = name;
    const moduleRef = await bootSlipsModule();

    expect(
      moduleRef.get<SlipVerifier>(SLIP_VERIFIER, { strict: false }),
    ).toBeInstanceOf(expected);
    await moduleRef.close();
  });

  it('binds the real SlipOK verifier when configured', async () => {
    process.env.SLIP_VERIFIER = 'slipok';
    process.env.SLIPOK_BRANCH_ID = 'branch';
    process.env.SLIPOK_API_KEY = 'key';

    const moduleRef = await bootSlipsModule();

    expect(
      moduleRef.get<SlipVerifier>(SLIP_VERIFIER, { strict: false }),
    ).toBeInstanceOf(SlipOkSlipVerifier);
    await moduleRef.close();
  });

  it('fails clearly when SlipOK credentials are absent', async () => {
    process.env.SLIP_VERIFIER = 'slipok';
    delete process.env.SLIPOK_BRANCH_ID;
    delete process.env.SLIPOK_API_KEY;

    await expect(bootSlipsModule()).rejects.toThrow('SLIPOK_BRANCH_ID');
  });

  it('exports the recording service and keeps the token internal', async () => {
    process.env.SLIP_VERIFIER = 'mock';
    const moduleRef = await bootSlipsModule();
    const exports: unknown[] =
      (Reflect.getMetadata('exports', SlipsModule) as unknown[]) ?? [];

    expect(
      moduleRef.get(SlipVerificationService, { strict: false }),
    ).toBeInstanceOf(SlipVerificationService);
    expect(exports).toContain(SlipVerificationService);
    expect(exports).not.toContain(SLIP_VERIFIER);
    await moduleRef.close();
  });
});
