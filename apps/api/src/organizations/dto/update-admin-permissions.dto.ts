import { IsBoolean } from 'class-validator';

export class UpdateAdminPermissionsDto {
  @IsBoolean()
  canManagePayments!: boolean;

  @IsBoolean()
  canManageZones!: boolean;
}
