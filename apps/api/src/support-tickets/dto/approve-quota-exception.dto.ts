import { IsUUID } from 'class-validator';

export class ApproveQuotaExceptionDto {
  @IsUUID()
  eventId!: string;

  @IsUUID()
  boothId!: string;
}
