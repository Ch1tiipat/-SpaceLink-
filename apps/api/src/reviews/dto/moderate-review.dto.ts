import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

export class ModerateReviewDto {
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  @Matches(/\S/, {
    message: 'reason must contain at least one non-whitespace character',
  })
  reason!: string;
}

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
