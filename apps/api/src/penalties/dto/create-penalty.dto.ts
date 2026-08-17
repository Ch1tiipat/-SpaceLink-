import { PenaltyReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePenaltyDto {
  @IsEnum(PenaltyReason)
  reason!: PenaltyReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
