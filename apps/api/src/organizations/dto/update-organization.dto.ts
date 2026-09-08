import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsUrl } from 'class-validator';
import { CreateOrganizationDto } from './create-organization.dto';

const SOCIAL_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_valid_protocol: true,
};

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @IsOptional()
  @IsUrl(SOCIAL_URL_OPTIONS, {
    message: 'facebookUrl ต้องเป็น URL แบบ http หรือ https',
  })
  facebookUrl?: string | null;

  @IsOptional()
  @IsUrl(SOCIAL_URL_OPTIONS, {
    message: 'lineUrl ต้องเป็น URL แบบ http หรือ https',
  })
  lineUrl?: string | null;
}
