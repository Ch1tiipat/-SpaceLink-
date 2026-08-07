import { IsString, Matches, ValidateIf } from 'class-validator';

/**
 * Thai numbers, digits only: a leading zero then 8 or 9 more, covering both
 * 10-digit mobile (06/08/09) and 9-digit landline (02-xxx-xxxx). Separators
 * are rejected rather than stripped — the stored value stays canonical.
 */
export const THAI_PHONE_PATTERN = /^0\d{8,9}$/;

/**
 * `fullName` is deliberately absent — the profile form has no field for it.
 *
 * `@ValidateIf` rather than `@IsOptional()`: the latter waves through `null`
 * as well as `undefined`, which would let `{"phone": null}` clear a stored
 * number. Omitting the key still means "leave it alone", but an explicit null
 * now fails `@IsString()` and returns 400. There is no clear-your-number use
 * case yet, so the ambiguous request is refused instead of guessed at.
 */
export class UpdateMeDto {
  @ValidateIf((dto: UpdateMeDto) => dto.phone !== undefined)
  @IsString()
  @Matches(THAI_PHONE_PATTERN)
  phone?: string;
}
