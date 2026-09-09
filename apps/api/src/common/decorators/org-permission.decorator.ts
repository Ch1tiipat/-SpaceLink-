import { SetMetadata } from '@nestjs/common';

export const ORG_PERMISSION_KEY = 'orgPermission';

export type OrgPermission = 'payments' | 'zones';

export const RequireOrgPermission = (permission: OrgPermission) =>
  SetMetadata(ORG_PERMISSION_KEY, permission);
