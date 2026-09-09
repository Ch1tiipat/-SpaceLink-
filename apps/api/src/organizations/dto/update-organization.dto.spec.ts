import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateOrganizationDto } from './update-organization.dto';

function constraintsFor(body: Record<string, unknown> = {}): string[] {
  const dto = plainToInstance(UpdateOrganizationDto, body);
  return validateSync(dto).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
}

describe('UpdateOrganizationDto', () => {
  it.each(['0812345678', '1234567890123', '123456789012345'])(
    'accepts a supported PromptPay identifier: %s',
    (promptpayId) => {
      expect(constraintsFor({ promptpayId })).toEqual([]);
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
    expect(constraintsFor({ promptpayId })).toContain('matches');
  });

  it.each([
    ['facebookUrl', 'https://www.facebook.com/spacelink'],
    ['facebookUrl', 'http://facebook.com/spacelink'],
    ['lineUrl', 'https://line.me/R/ti/p/@spacelink'],
    ['lineUrl', 'http://line.me/ti/p/@spacelink'],
  ])('accepts an http(s) %s', (field, value) => {
    expect(constraintsFor({ [field]: value })).toEqual([]);
  });

  it.each(['facebookUrl', 'lineUrl'])(
    'accepts an omitted or null %s so an admin can clear it',
    (field) => {
      expect(constraintsFor()).toEqual([]);
      expect(constraintsFor({ [field]: null })).toEqual([]);
    },
  );

  it.each([
    ['facebookUrl', 'javascript:alert(1)'],
    ['facebookUrl', 'data:text/html,unsafe'],
    ['facebookUrl', '//facebook.com/spacelink'],
    ['lineUrl', 'ftp://line.me/spacelink'],
    ['lineUrl', '<script>alert(1)</script>'],
  ])('rejects an unsafe or unsupported %s: %s', (field, value) => {
    expect(constraintsFor({ [field]: value })).toContain('isUrl');
  });
});
