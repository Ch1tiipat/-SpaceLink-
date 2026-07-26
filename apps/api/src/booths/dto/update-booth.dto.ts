import { PartialType } from '@nestjs/mapped-types';
import { CreateBoothDto } from './create-booth.dto';

export class UpdateBoothDto extends PartialType(CreateBoothDto) {}
