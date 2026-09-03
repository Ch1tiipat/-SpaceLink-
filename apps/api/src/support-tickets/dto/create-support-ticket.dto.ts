import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

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
  @Matches(UUID_SHAPE)
  eventId?: string;

  @ValidateIf(
    (request: CreateSupportTicketDto) =>
      request.requestType === SupportTicketRequestType.QUOTA_INCREASE,
  )
  @Matches(UUID_SHAPE)
  zoneId?: string;

  @ValidateIf(
    (request: CreateSupportTicketDto) =>
      request.requestType === SupportTicketRequestType.QUOTA_INCREASE,
  )
  @Matches(UUID_SHAPE)
  boothId?: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  bookingId?: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
