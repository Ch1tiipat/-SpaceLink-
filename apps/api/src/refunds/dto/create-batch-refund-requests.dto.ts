import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateBatchRefundItemDto {
  @IsUUID()
  bookingId!: string;

  @Matches(/^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
  requestedAmount!: string;
}

export class CreateBatchRefundRequestsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBatchRefundItemDto)
  items!: CreateBatchRefundItemDto[];

  @IsIn(['PROMPTPAY'])
  payoutMethod!: 'PROMPTPAY';

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  payoutAccountName?: string;

  @Matches(/^(\d{10}|\d{13}|\d{15})$/)
  payoutPromptPayId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
