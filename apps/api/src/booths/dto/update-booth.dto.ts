import { PartialType } from '@nestjs/mapped-types';
import { BoothStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateBoothDto } from './create-booth.dto';

/**
 * Everything on `CreateBoothDto` becomes optional, plus `status`, which is not
 * settable at creation time (a new booth is always `AVAILABLE`).
 */
export class UpdateBoothDto extends PartialType(CreateBoothDto) {
  @IsOptional()
  @IsEnum(BoothStatus)
  status?: BoothStatus;
}
