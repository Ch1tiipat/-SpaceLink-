import { PartialType } from '@nestjs/mapped-types';
import { ArrayMinSize, IsArray, IsUUID, ValidateIf } from 'class-validator';
import { CreateShopDto } from './create-shop.dto';

/**
 * Every field on CreateShopDto becomes optional.
 *
 * `categoryIds` is redeclared rather than left to PartialType because
 * PartialType injects `@IsOptional()`, which skips validation for `null` as
 * well as `undefined` — so `{"categoryIds": null}` would have slipped through
 * and been read as "leave them alone". `@ValidateIf` narrows that to
 * `undefined` only, matching the `phone` rule in update-me.dto.ts: omitting
 * the key means no change, an explicit null is a 400.
 *
 * Redeclaring genuinely overrides the inherited `@IsOptional()` here — verified
 * against both this shape and a standalone class, and pinned by
 * update-shop.dto.spec.ts.
 *
 * `@ArrayMinSize(1)` still applies, so `[]` is rejected too: a shop cannot be
 * left with no category.
 */
export class UpdateShopDto extends PartialType(CreateShopDto) {
  @ValidateIf((dto: UpdateShopDto) => dto.categoryIds !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  categoryIds?: string[];
}
