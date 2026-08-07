import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateMeDto } from './update-me.dto';

/**
 * The phone contract lives entirely in decorators, so it is tested by running
 * the real validator rather than by calling a method.
 *
 * The null case is the load-bearing one. `@ValidateIf(...)` + `@IsString()`
 * reads like a long-winded `@IsOptional()` and is an easy "simplification" to
 * make — but `@IsOptional()` waves through null as well as undefined, so that
 * edit would silently let `{"phone": null}` clear a stored number. Every other
 * gate would still pass. This test is what fails instead.
 */
function constraintsFor(body: Record<string, unknown>): string[] {
  const dto = plainToInstance(UpdateMeDto, body);
  return validateSync(dto).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
}

const ACCEPTED: [string, Record<string, unknown>][] = [
  ['an omitted phone, meaning leave it unchanged', {}],
  ['a 10-digit mobile number', { phone: '0812345678' }],
  ['a 9-digit landline number', { phone: '021234567' }],
];

const REJECTED: [string, Record<string, unknown>][] = [
  ['an explicit null', { phone: null }],
  ['separators', { phone: '081-234-5678' }],
  ['a missing leading zero', { phone: '812345678' }],
  ['a too-short number', { phone: '08123456' }],
  ['a too-long number', { phone: '08123456789' }],
  ['a numeric type', { phone: 812345678 }],
];

describe('UpdateMeDto', () => {
  it.each(ACCEPTED)('accepts %s', (_label, body) => {
    expect(constraintsFor(body)).toEqual([]);
  });

  it.each(REJECTED)('rejects %s', (_label, body) => {
    expect(constraintsFor(body).length).toBeGreaterThan(0);
  });

  it('rejects null on the type check, not only on the pattern', () => {
    expect(constraintsFor({ phone: null })).toEqual(
      expect.arrayContaining(['isString']),
    );
  });

  it('declares no fullName field', () => {
    const dto = plainToInstance(UpdateMeDto, {
      phone: '0812345678',
      fullName: 'Someone Else',
    });

    // ValidationPipe runs with whitelist: true, so an undeclared field is
    // stripped rather than saved (§14.4). Nothing here declares fullName.
    expect(Object.keys(new UpdateMeDto())).not.toContain('fullName');
    expect(constraintsFor({ phone: dto.phone })).toEqual([]);
  });
});
