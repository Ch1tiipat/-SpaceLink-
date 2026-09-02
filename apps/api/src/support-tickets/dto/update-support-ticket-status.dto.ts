import { TicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSupportTicketStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
