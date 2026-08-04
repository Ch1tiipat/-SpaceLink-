import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

/**
 * `venueId` is deliberately absent: it comes from the `:venueId` route param
 * that `@OrgScoped('venueId')` already verified on `VenuesController`, never
 * from the request body (AGENTS.md §14.2).
 */
export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Money stays a string end to end (AGENTS.md §6.1) — Prisma accepts a string
   * for a `Decimal` column directly, so it never passes through a float. The
   * pattern is `Decimal(10,2)`: non-negative, at most two decimal places.
   */
  @IsOptional()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,2})?$/)
  defaultBoothPrice?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  posX?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  posY?: number;
}
