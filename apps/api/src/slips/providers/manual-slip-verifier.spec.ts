import { Logger } from '@nestjs/common';
import { SlipStatus } from '@prisma/client';
import { ManualSlipVerifier } from './manual-slip-verifier';

describe('ManualSlipVerifier', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  // ERROR, never INVALID. The distinction is the whole point of this provider:
  // INVALID asserts the slip was examined and found wrong, which would be an
  // untrue statement about a vendor's payment. ERROR says only that automatic
  // verification was unavailable, which under §8 step 4 leaves the booking at
  // PENDING_PAYMENT instead of writing off a real payment.
  it('returns ERROR, not INVALID', async () => {
    const result = await new ManualSlipVerifier().verify();

    expect(result.status).toBe(SlipStatus.ERROR);
    expect(result.status).not.toBe(SlipStatus.INVALID);
  });

  it('points the admin at the payment-exempt path', async () => {
    const result = await new ManualSlipVerifier().verify();

    // The message is read by an ORG_ADMIN deciding what to do next, so it has
    // to name the route out: a CONFIRMED booking with `isPaymentExempt = true`
    // and a reason (§8 step 6).
    expect(result.message).toContain('isPaymentExempt');
    expect(result.message).toContain('ORG_ADMIN');
  });

  it('carries no transaction details', async () => {
    const result = await new ManualSlipVerifier().verify();

    // Nothing was read off the slip, so there is nothing to claim about it.
    expect(result.transRef).toBeUndefined();
    expect(result.amount).toBeUndefined();
    expect(result.senderName).toBeUndefined();
    expect(result.raw).toBeUndefined();
  });

  it('warns that the slip needs a human', async () => {
    await new ManualSlipVerifier().verify();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ORG_ADMIN') as string,
    );
  });
});
