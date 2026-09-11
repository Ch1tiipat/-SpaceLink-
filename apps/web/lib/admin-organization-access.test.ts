/* eslint-disable @typescript-eslint/no-require-imports -- Node runs this TypeScript test directly. */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const {
  buildAdminOrganizationCatalog,
  selectAdminOrganizationId,
} = require('./admin-organization-access.ts') as typeof import('./admin-organization-access');
import type { CurrentUser, SuperAdminOrganization } from './api';

type MembershipOrganization = CurrentUser['organizations'][number];

const membership: MembershipOrganization = {
  id: 'membership-org',
  name: 'Membership Organization',
  promptpayId: null,
  facebookUrl: null,
  lineUrl: null,
  membershipRole: 'ADMIN',
  canEditQuota: true,
  canManagePayments: true,
  canManageZones: false,
  bookingQuotaPerVendor: 2,
};

const platformOrganization: SuperAdminOrganization = {
  id: 'platform-org',
  name: 'Platform Organization',
  description: null,
  contactEmail: 'admin@example.com',
  contactPhone: null,
  facebookUrl: null,
  lineUrl: null,
  logoUrl: null,
  status: 'ACTIVE',
};

test('ORG_ADMIN catalog keeps membership access and permissions', () => {
  assert.deepEqual(
    buildAdminOrganizationCatalog(
      'ORG_ADMIN',
      [membership],
      [platformOrganization],
    ),
    [
      {
        id: 'membership-org',
        name: 'Membership Organization',
        accessSource: 'MEMBERSHIP',
        membershipRole: 'ADMIN',
        canEditQuota: true,
        canManagePayments: true,
        canManageZones: false,
      },
    ],
  );
});

test('SUPER_ADMIN catalog uses all organizations without fake membership', () => {
  assert.deepEqual(
    buildAdminOrganizationCatalog(
      'SUPER_ADMIN',
      [],
      [platformOrganization],
    ),
    [
      {
        id: 'platform-org',
        name: 'Platform Organization',
        accessSource: 'SUPER_ADMIN',
        membershipRole: null,
        canEditQuota: false,
        canManagePayments: false,
        canManageZones: false,
      },
    ],
  );
});

test('non-admin roles do not receive an admin organization catalog', () => {
  assert.deepEqual(
    buildAdminOrganizationCatalog(
      'VENDOR',
      [membership],
      [platformOrganization],
    ),
    [],
  );
});

test('organization selection prefers requested, stored, then first valid id', () => {
  const organizations = [{ id: 'first' }, { id: 'second' }];

  assert.equal(
    selectAdminOrganizationId(organizations, 'second', 'first'),
    'second',
  );
  assert.equal(
    selectAdminOrganizationId(organizations, 'unknown', 'second'),
    'second',
  );
  assert.equal(
    selectAdminOrganizationId(organizations, 'unknown', 'missing'),
    'first',
  );
  assert.equal(selectAdminOrganizationId([], 'unknown', 'missing'), '');
});
