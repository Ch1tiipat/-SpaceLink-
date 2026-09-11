import { EventInformationType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateEventInformationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(5000)
  description!: string;

  @IsEnum(EventInformationType)
  type!: EventInformationType;
}
