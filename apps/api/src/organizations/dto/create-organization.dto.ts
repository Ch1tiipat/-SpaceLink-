import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @Matches(/^(\d{10}|\d{13}|\d{15})$/, {
    message: 'promptpayId ต้องเป็นตัวเลข 10, 13 หรือ 15 หลัก',
  })
  promptpayId?: string;
}
