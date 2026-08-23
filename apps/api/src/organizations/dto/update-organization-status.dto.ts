import { IsEnum } from 'class-validator';
import { OrgStatus } from '@prisma/client';

export class UpdateOrganizationStatusDto {
  @IsEnum(OrgStatus)
  status!: OrgStatus;
}
