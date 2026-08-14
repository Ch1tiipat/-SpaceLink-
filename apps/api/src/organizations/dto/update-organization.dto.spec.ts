import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateOrganizationDto } from './update-organization.dto';

function constraintsFor(promptpayId?: unknown): string[] {
  const body = promptpayId === undefined ? {} : { promptpayId };
  const dto = plainToInstance(UpdateOrganizationDto, body);
  return validateSync(dto).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
}

describe('UpdateOrganizationDto', () => {
  it.each(['0812345678', '1234567890123', '123456789012345'])(
    'accepts a supported PromptPay identifier: %s',
    (promptpayId) => {
      expect(constraintsFor(promptpayId)).toEqual([]);
    },
  );

  it('accepts an omitted PromptPay identifier', () => {
    expect(constraintsFor()).toEqual([]);
  });

  it.each([
    '812345678',
    '081-234-5678',
    '123456789012',
    '12345678901234',
    '1234567890123456',
    'abcdefghij',
  ])('rejects an unsupported PromptPay identifier: %s', (promptpayId) => {
    expect(constraintsFor(promptpayId)).toContain('matches');
  });
});
