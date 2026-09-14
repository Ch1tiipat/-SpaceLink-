import { IsBoolean, ValidateIf } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  BOOKING_STATUS?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  PAYMENT?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  ANNOUNCEMENT?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  PENALTY?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  REFUND?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  SUPPORT_TICKET?: boolean;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsBoolean()
  SYSTEM?: boolean;
}
