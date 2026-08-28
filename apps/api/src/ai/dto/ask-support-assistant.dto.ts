import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export type SupportAssistantMessageRole = 'user' | 'assistant';

export class SupportAssistantMessageDto {
  @IsIn(['user', 'assistant'])
  role!: SupportAssistantMessageRole;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}

export class AskSupportAssistantDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SupportAssistantMessageDto)
  history?: SupportAssistantMessageDto[];
}

function trimString(params: TransformFnParams): unknown {
  const value = params.value as unknown;
  return typeof value === 'string' ? value.trim() : value;
}
