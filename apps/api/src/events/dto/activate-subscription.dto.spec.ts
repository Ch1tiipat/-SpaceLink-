import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ActivateSubscriptionDto } from './activate-subscription.dto';

describe('ActivateSubscriptionDto', () => {
  it('accepts a non-empty manual activation reason', () => {
    const dto = plainToInstance(ActivateSubscriptionDto, {
      reason: 'ตรวจสอบการชำระเงินโดยผู้ดูแลระบบแล้ว',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it.each([undefined, '', 123])('rejects invalid reason %s', (reason) => {
    const dto = plainToInstance(ActivateSubscriptionDto, { reason });

    expect(validateSync(dto)).not.toHaveLength(0);
  });
});
