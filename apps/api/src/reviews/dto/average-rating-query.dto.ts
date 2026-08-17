import { ReviewTargetType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class AverageRatingQueryDto {
  @IsEnum(ReviewTargetType)
  targetType!: ReviewTargetType;

  @IsUUID()
  targetId!: string;
}
