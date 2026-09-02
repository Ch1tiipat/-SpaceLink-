import { IsInt, Min } from 'class-validator';

export class UpdateBookingQuotaDto {
  @IsInt()
  @Min(0)
  bookingQuotaPerVendor!: number;
}
