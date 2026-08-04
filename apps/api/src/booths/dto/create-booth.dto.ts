import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

/**
 * `zoneId` is deliberately absent: it comes from the `:zoneId` route param
 * that `@OrgScoped('zoneId')` already verified on `ZonesController`, never
 * from the request body (AGENTS.md §14.2).
 *
 * `status` is absent too — a new booth takes the schema default `AVAILABLE`,
 * and it is only changeable through `UpdateBoothDto`.
 */
export class CreateBoothDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  /**
   * Money stays a string end to end (AGENTS.md §6.1) — Prisma accepts a string
   * for a `Decimal` column directly, so it never passes through a float. The
   * pattern is `Decimal(10,2)`: non-negative, at most two decimal places.
   */
  @Matches(/^(0|[1-9]\d*)(\.\d{1,2})?$/)
  boothPrice!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  widthM?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  heightM?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  posX?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  posY?: number;
}
