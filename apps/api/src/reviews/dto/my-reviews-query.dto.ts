import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class MyReviewsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}
