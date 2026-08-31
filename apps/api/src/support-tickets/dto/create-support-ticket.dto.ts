import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export enum SupportTicketRequestType {
  QUOTA_INCREASE = 'QUOTA_INCREASE',
  ISSUE_REPORT = 'ISSUE_REPORT',
}

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketRequestType)
  requestType!: SupportTicketRequestType;

  @ValidateIf(
    (request: CreateSupportTicketDto) =>
      request.requestType === SupportTicketRequestType.QUOTA_INCREASE,
  )
  @IsUUID()
  eventId?: string;

  @ValidateIf(
    (request: CreateSupportTicketDto) =>
      request.requestType === SupportTicketRequestType.QUOTA_INCREASE,
  )
  @IsUUID()
  zoneId?: string;

  @ValidateIf(
    (request: CreateSupportTicketDto) =>
      request.requestType === SupportTicketRequestType.QUOTA_INCREASE,
  )
  @IsUUID()
  boothId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
