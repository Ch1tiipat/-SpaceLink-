import { PenaltyReason } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePenaltyDto {
  @IsEnum(PenaltyReason)
  reason!: PenaltyReason;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  points?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
