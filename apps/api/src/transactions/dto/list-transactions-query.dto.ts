import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BookingStatus } from '@prisma/client';
import { UUID_SHAPE } from '../../common/utils/uuid.util';
import {
  PAYMENT_STATES,
  REFUND_STATES,
  TRANSACTION_VIEWS,
  type PaymentState,
  type RefundState,
  type TransactionView,
} from '../transaction-state';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ListTransactionsQueryDto {
  @IsOptional()
  @IsIn(TRANSACTION_VIEWS)
  view: TransactionView = 'BOOKINGS';

  @IsOptional()
  @Matches(UUID_SHAPE)
  eventId?: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  zoneId?: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  vendorUserId?: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  shopId?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  @IsOptional()
  @IsIn(PAYMENT_STATES)
  paymentStatus?: PaymentState;

  @IsOptional()
  @IsIn(REFUND_STATES)
  refundStatus?: RefundState;

  @IsOptional()
  @Matches(DATE_ONLY)
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  to?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
