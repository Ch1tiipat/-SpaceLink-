import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** A rejection must say why: the reason is shown to the vendor verbatim. */
export class RejectQuotaExceptionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @Matches(/\S/, {
    message: 'reason must contain at least one non-whitespace character',
  })
  @MaxLength(500)
  reason!: string;
}

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
