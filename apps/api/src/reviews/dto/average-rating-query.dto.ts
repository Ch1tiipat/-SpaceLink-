import { ReviewTargetType } from '@prisma/client';
import { IsEnum, Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class AverageRatingQueryDto {
  @IsEnum(ReviewTargetType)
  targetType!: ReviewTargetType;

  @Matches(UUID_SHAPE)
  targetId!: string;
}
