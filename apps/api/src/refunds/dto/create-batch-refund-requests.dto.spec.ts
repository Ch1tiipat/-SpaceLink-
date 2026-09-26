import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBatchRefundRequestsDto } from './create-batch-refund-requests.dto';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const base = {
  items: [{ bookingId: BOOKING_ID, requestedAmount: '1500.00' }],
  reason: 'ยกเลิกก่อนวันเริ่มงาน',
  payoutMethod: 'PROMPTPAY',
  payoutAccountName: 'Vendor One',
  payoutPromptPayId: '0123456789',
};

const errors = (data: object) =>
  validate(plainToInstance(CreateBatchRefundRequestsDto, data));

describe('CreateBatchRefundRequestsDto', () => {
  it('accepts one or more per-booking refund amounts', async () => {
    await expect(
      errors({
        ...base,
        items: [
          ...base.items,
          {
            bookingId: '22222222-2222-4222-8222-222222222222',
            requestedAmount: '900',
          },
        ],
      }),
    ).resolves.toHaveLength(0);
  });

  it.each([undefined, [], [{}]])('rejects invalid items: %p', async (items) => {
    expect((await errors({ ...base, items })).length).toBeGreaterThan(0);
  });

  it.each(['0', '1.001', '100000000', '-1'])(
    'rejects invalid Decimal(10,2) amount %s',
    async (requestedAmount) => {
      expect(
        (
          await errors({
            ...base,
            items: [{ bookingId: BOOKING_ID, requestedAmount }],
          })
        ).length,
      ).toBeGreaterThan(0);
    },
  );

  it('rejects a non-UUID booking id', async () => {
    expect(
      (
        await errors({
          ...base,
          items: [{ bookingId: 'A01', requestedAmount: '100' }],
        })
      ).length,
    ).toBeGreaterThan(0);
  });
});
