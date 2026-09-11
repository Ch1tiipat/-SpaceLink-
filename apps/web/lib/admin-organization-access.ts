import type {
  CurrentUser,
  SuperAdminOrganization,
  UserRole,
} from './api';

type MembershipOrganization = CurrentUser['organizations'][number];

export type AdminOrganization = {
  id: string;
  name: string;
  accessSource: 'MEMBERSHIP' | 'SUPER_ADMIN';
  membershipRole: MembershipOrganization['membershipRole'] | null;
  canEditQuota: boolean;
  canManagePayments: boolean;
  canManageZones: boolean;
};

export function buildAdminOrganizationCatalog(
  role: UserRole,
  memberships: MembershipOrganization[],
  platformOrganizations: SuperAdminOrganization[],
): AdminOrganization[] {
  if (role === 'SUPER_ADMIN') {
    return platformOrganizations.map(({ id, name }) => ({
      id,
      name,
      accessSource: 'SUPER_ADMIN',
      membershipRole: null,
      canEditQuota: false,
      canManagePayments: false,
      canManageZones: false,
    }));
  }

  if (role !== 'ORG_ADMIN') return [];

  return memberships.map((organization) => ({
    id: organization.id,
    name: organization.name,
    accessSource: 'MEMBERSHIP',
    membershipRole: organization.membershipRole,
    canEditQuota: organization.canEditQuota,
    canManagePayments: organization.canManagePayments,
    canManageZones: organization.canManageZones,
  }));
}

export function selectAdminOrganizationId(
  organizations: Pick<AdminOrganization, 'id'>[],
  requestedId: string | null | undefined,
  storedId?: string | null,
): string {
  if (
    requestedId &&
    organizations.some((organization) => organization.id === requestedId)
  ) {
    return requestedId;
  }

  if (
    storedId &&
    organizations.some((organization) => organization.id === storedId)
  ) {
    return storedId;
  }

  return organizations[0]?.id ?? '';
}
