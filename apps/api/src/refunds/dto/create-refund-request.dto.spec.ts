import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRefundRequestDto } from './create-refund-request.dto';

const base = {
  reason: 'ยกเลิกงาน',
  requestedAmount: '100',
  payoutMethod: 'PROMPTPAY',
  payoutAccountName: 'Test Vendor',
  payoutPromptPayId: '0123456789',
};
const errors = (data: object) =>
  validate(plainToInstance(CreateRefundRequestDto, data));

describe('CreateRefundRequestDto payout validation', () => {
  it.each([10, 13, 15])('accepts a %i digit PromptPay id', async (length) => {
    expect(
      await errors({ ...base, payoutPromptPayId: '0'.repeat(length) }),
    ).toHaveLength(0);
  });
  it.each(['', '123', '012345678901', 'abcdefghij'])(
    'rejects invalid PromptPay %s',
    async (value) => {
      expect(
        (await errors({ ...base, payoutPromptPayId: value })).length,
      ).toBeGreaterThan(0);
    },
  );
  it.each([undefined, null, '', '   '])(
    'requires an account name: %s',
    async (value) => {
      expect(
        (await errors({ ...base, payoutAccountName: value })).length,
      ).toBeGreaterThan(0);
    },
  );
  it('requires bank details only for bank transfers and preserves leading zeroes', async () => {
    const bank = {
      ...base,
      payoutMethod: 'BANK_TRANSFER',
      payoutPromptPayId: undefined,
    };
    expect((await errors(bank)).length).toBeGreaterThan(0);
    expect(
      await errors({
        ...bank,
        payoutBankName: 'Test Bank',
        payoutAccountNumber: '0012345678',
      }),
    ).toHaveLength(0);
  });
  it('rejects unsupported methods and missing payout fields on new requests', async () => {
    expect(
      (await errors({ ...base, payoutMethod: 'CASH' })).length,
    ).toBeGreaterThan(0);
    expect(
      (await errors({ reason: 'cancel', requestedAmount: '100' })).length,
    ).toBeGreaterThan(0);
  });
});
