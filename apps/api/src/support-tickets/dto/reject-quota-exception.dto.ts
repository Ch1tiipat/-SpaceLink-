import { IsString, MaxLength, MinLength } from 'class-validator';

/** A rejection must say why: the reason is shown to the vendor verbatim. */
export class RejectQuotaExceptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
