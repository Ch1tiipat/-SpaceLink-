import { IsBoolean } from 'class-validator';

export class UpdateQuotaPermissionDto {
  @IsBoolean()
  canEditQuota!: boolean;
}
