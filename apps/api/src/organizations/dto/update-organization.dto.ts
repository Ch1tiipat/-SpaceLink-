import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, Matches } from 'class-validator';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @IsOptional()
  @Matches(/^(\d{10}|\d{13}|\d{15})$/, {
    message: 'promptpayId ต้องเป็นตัวเลข 10, 13 หรือ 15 หลัก',
  })
  promptpayId?: string;
}
