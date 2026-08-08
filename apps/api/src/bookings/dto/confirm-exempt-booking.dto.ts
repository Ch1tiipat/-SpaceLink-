import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmExemptBookingDto {
  @IsString()
  @IsNotEmpty()
  paymentExemptReason!: string;
}
