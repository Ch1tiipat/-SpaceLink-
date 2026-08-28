import { IsOptional, Matches } from 'class-validator';

const MONEY_PATTERN = /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/;

/**
 * Billing values stay as decimal-compatible strings at the API boundary.
 * This avoids converting money through JavaScript floating point.
 */
export class UpdatePlatformConfigDto {
  @IsOptional()
  @Matches(MONEY_PATTERN)
  baseFee?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN)
  perZoneRate?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN)
  perDayRate?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN)
  priceMin?: string;

  @IsOptional()
  @Matches(MONEY_PATTERN)
  priceMax?: string;
}
