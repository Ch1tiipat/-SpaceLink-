import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class CreateReviewDto {
  @Matches(UUID_SHAPE)
  bookingId!: string;

  @IsIn(['BOOTH', 'ZONE'])
  targetType!: 'BOOTH' | 'ZONE';

  @Matches(UUID_SHAPE)
  targetId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reviewerDisplayName?: string;
}
