import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SlipStatus } from '@prisma/client';
import type { SlipVerificationInput } from '../slip-verifier.interface';
import { MockSlipVerifier } from './mock-slip-verifier';
import type { MockSlipVerifierMode } from './mock-slip-verifier';

const INPUT: SlipVerificationInput = {
  slipImageUrl: 'https://example.invalid/signed/slip.jpg',
  expectedAmount: new Prisma.Decimal('1500.00'),
};

function createVerifier(mode?: MockSlipVerifierMode): MockSlipVerifier {
  const config = { get: jest.fn().mockReturnValue(mode) };

  return new MockSlipVerifier(config as unknown as ConfigService);
}

describe('MockSlipVerifier', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  describe('always-verified', () => {
    it('returns VERIFIED with the amount it was handed', async () => {
      const result = await createVerifier('always-verified').verify(INPUT);

      expect(result.status).toBe(SlipStatus.VERIFIED);
      // `.equals()`, not `===` or `toBe`: two Decimals holding the same value
      // are different objects, and §6.3.7 compares the slip amount to
      // `booking.boothPrice` for exact numeric equality. Asserting on identity
      // here would pass today and start failing the moment the mock rebuilds
      // the value instead of passing it through — which is not a defect.
      expect(result.amount?.equals(INPUT.expectedAmount)).toBe(true);
      expect(result.amount?.equals(new Prisma.Decimal('1500'))).toBe(true);
    });

    it('is the default when SLIP_VERIFIER_MODE is unset', async () => {
      const result = await createVerifier(undefined).verify(INPUT);

      expect(result.status).toBe(SlipStatus.VERIFIED);
    });

    // `trans_ref` is `@unique` in the schema, so a fixed mock value would let
    // the first booking through and fail the second on a constraint violation —
    // a bug that only ever shows up on the second demo booking.
    it('produces a different transRef on every call', async () => {
      const verifier = createVerifier('always-verified');

      const first = await verifier.verify(INPUT);
      const second = await verifier.verify(INPUT);

      expect(first.transRef).toBeDefined();
      expect(second.transRef).toBeDefined();
      expect(first.transRef).not.toBe(second.transRef);
    });
  });

  describe('always-invalid', () => {
    it('returns INVALID and no transaction details', async () => {
      const result = await createVerifier('always-invalid').verify(INPUT);

      expect(result.status).toBe(SlipStatus.INVALID);
      // A slip that did not pass carries nothing to record about the payment.
      expect(result.transRef).toBeUndefined();
      expect(result.amount).toBeUndefined();
    });
  });

  // A mock left enabled by accident confirms bookings nobody paid for, so every
  // call must say so — not once at boot, where the line scrolls away.
  it('warns on every call that nothing was checked', async () => {
    const verifier = createVerifier('always-verified');

    await verifier.verify(INPUT);
    await verifier.verify(INPUT);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('MOCK') as string,
    );
  });

  it('never logs the slip URL', async () => {
    await createVerifier('always-verified').verify(INPUT);

    // The URL is a short-lived signed URL to a private object (§14.1).
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining(INPUT.slipImageUrl) as string,
    );
  });
});
