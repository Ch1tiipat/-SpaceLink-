import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Money remains a Decimal-compatible string at the API boundary. Decimal(10,2)
 * permits at most eight integer digits; the negative lookahead rejects zero.
 * Evidence is deliberately not accepted by the basic feature: arbitrary public
 * URLs are not an authorization-safe substitute for private Supabase Storage.
 */
export class CreateRefundRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @Matches(/^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
  requestedAmount!: string;
}
