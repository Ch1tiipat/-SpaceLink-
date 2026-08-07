import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateShopDto } from './update-shop.dto';

/**
 * The category rules are decorator-only, so they are tested by running the
 * real validator rather than by calling a method.
 *
 * Two of these are load-bearing. `null` must be rejected: PartialType injects
 * `@IsOptional()`, which waves null through, so the redeclared `@ValidateIf`
 * in UpdateShopDto is the only thing standing between a null and a silent
 * "leave the categories alone". And `[]` must be rejected, or a shop can be
 * stripped of every category — ShopsService.updateMe deletes the old rows
 * before inserting the new ones, so an empty array would leave none behind.
 */
function constraintsFor(body: Record<string, unknown>): string[] {
  const dto = plainToInstance(UpdateShopDto, body);
  return validateSync(dto).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
}

const VALID_ID = '33333333-3333-4333-8333-333333333333';

describe('UpdateShopDto', () => {
  describe('categoryIds', () => {
    it('accepts the key being omitted, meaning leave categories unchanged', () => {
      expect(constraintsFor({ name: 'ร้านขนมไทย' })).toEqual([]);
    });

    it('accepts a non-empty array of UUIDs', () => {
      expect(constraintsFor({ categoryIds: [VALID_ID] })).toEqual([]);
    });

    it('rejects an explicit null despite PartialType marking it optional', () => {
      expect(constraintsFor({ categoryIds: null }).length).toBeGreaterThan(0);
    });

    it('rejects an empty array so a shop cannot lose every category', () => {
      expect(constraintsFor({ categoryIds: [] })).toEqual(
        expect.arrayContaining(['arrayMinSize']),
      );
    });

    it('rejects a non-UUID entry', () => {
      expect(constraintsFor({ categoryIds: ['not-a-uuid'] })).toEqual(
        expect.arrayContaining(['isUuid']),
      );
    });

    it('rejects a non-array value', () => {
      expect(constraintsFor({ categoryIds: VALID_ID }).length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('other fields', () => {
    it('accepts a patch that touches only the name', () => {
      expect(constraintsFor({ name: 'ชื่อใหม่' })).toEqual([]);
    });

    it('rejects an empty name', () => {
      expect(constraintsFor({ name: '' })).toEqual(
        expect.arrayContaining(['isNotEmpty']),
      );
    });

    it('accepts an entirely empty patch', () => {
      expect(constraintsFor({})).toEqual([]);
    });
  });
});
