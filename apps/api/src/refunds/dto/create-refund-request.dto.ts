import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Money remains a Decimal-compatible string at the API boundary. Decimal(10,2)
 * permits at most eight integer digits; the negative lookahead rejects zero.
 * Evidence is deliberately not accepted by the basic feature: arbitrary public
 * URLs are not an authorization-safe substitute for private Supabase Storage.
 */
export class CreateRefundRequestDto {
  @IsIn(['PROMPTPAY', 'BANK_TRANSFER'])
  payoutMethod!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  payoutAccountName!: string;

  @ValidateIf((dto: CreateRefundRequestDto) => dto.payoutMethod === 'PROMPTPAY')
  @Matches(/^(\d{10}|\d{13}|\d{15})$/)
  payoutPromptPayId?: string;

  @ValidateIf(
    (dto: CreateRefundRequestDto) => dto.payoutMethod === 'BANK_TRANSFER',
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  payoutBankName?: string;

  @ValidateIf(
    (dto: CreateRefundRequestDto) => dto.payoutMethod === 'BANK_TRANSFER',
  )
  @Matches(/^\d{6,20}$/)
  payoutAccountNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @Matches(/^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
  requestedAmount!: string;
}
