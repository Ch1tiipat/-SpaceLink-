import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateShopDto } from './create-shop.dto';

function constraintsFor(body: Record<string, unknown>): string[] {
  const dto = plainToInstance(CreateShopDto, body);
  return validateSync(dto).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
}

const VALID_ID = '33333333-3333-4333-8333-333333333333';
const LEGACY_ID = '33333333-3333-3333-3333-333333333333';

describe('CreateShopDto', () => {
  it('accepts a name with at least one category', () => {
    expect(
      constraintsFor({ name: 'ร้านขนมไทย', categoryIds: [VALID_ID] }),
    ).toEqual([]);
  });

  it('accepts a legacy UUID-shaped category id', () => {
    expect(
      constraintsFor({ name: 'ร้านขนมไทย', categoryIds: [LEGACY_ID] }),
    ).toEqual([]);
  });

  it('accepts the optional description and logoUrl', () => {
    expect(
      constraintsFor({
        name: 'ร้านขนมไทย',
        description: 'ขนมไทยโบราณ',
        logoUrl: 'shops/logo.png',
        categoryIds: [VALID_ID],
      }),
    ).toEqual([]);
  });

  /*
   * The mirror of the UpdateShopDto case: a shop must never be created with no
   * category, because the category is what decides which zones it can book.
   */
  it('rejects an empty categoryIds array', () => {
    expect(constraintsFor({ name: 'ร้านขนมไทย', categoryIds: [] })).toEqual(
      expect.arrayContaining(['arrayMinSize']),
    );
  });

  it('rejects categoryIds being absent entirely', () => {
    expect(constraintsFor({ name: 'ร้านขนมไทย' }).length).toBeGreaterThan(0);
  });

  it('rejects a null categoryIds', () => {
    expect(
      constraintsFor({ name: 'ร้านขนมไทย', categoryIds: null }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects a non-UUID entry', () => {
    expect(
      constraintsFor({ name: 'ร้านขนมไทย', categoryIds: ['not-a-uuid'] }),
    ).toEqual(expect.arrayContaining(['matches']));
  });

  it('rejects a missing name', () => {
    expect(constraintsFor({ categoryIds: [VALID_ID] })).toEqual(
      expect.arrayContaining(['isNotEmpty']),
    );
  });

  it('rejects an empty name', () => {
    expect(constraintsFor({ name: '', categoryIds: [VALID_ID] })).toEqual(
      expect.arrayContaining(['isNotEmpty']),
    );
  });
});
