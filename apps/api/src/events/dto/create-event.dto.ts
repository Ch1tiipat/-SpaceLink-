import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class CreateEventDto {
  @Matches(UUID_SHAPE)
  venueId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  /** Present on the final create request after the administrator saw a quote. */
  @IsOptional()
  @Matches(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/)
  expectedFinalPrice?: string;
}
