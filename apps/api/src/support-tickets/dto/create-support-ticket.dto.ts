import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateSupportTicketDto {
  @IsUUID()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
