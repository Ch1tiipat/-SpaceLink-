import { IsNotEmpty, IsString } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  cancelReason!: string;
}
