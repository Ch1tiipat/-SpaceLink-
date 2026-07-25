import { SetMetadata } from '@nestjs/common';

export const ORG_SCOPE_KEY = 'orgScope';

/**
 * The route params OrgScopeGuard knows how to resolve to an organization.
 * Each one is a step on the ownership chain (CLAUDE.md §5):
 * Organization -> Venue -> Zone -> Booth, with Event hanging off Organization.
 */
export type OrgScopeParam =
  'organizationId' | 'venueId' | 'eventId' | 'zoneId' | 'boothId';

/**
 * Marks a handler as org-scoped, naming the route param that identifies the
 * resource, e.g. `@Get(':venueId')` paired with `@OrgScope('venueId')`.
 * Read by OrgScopeGuard, which resolves it to an organization and checks
 * membership in our database.
 */
export const OrgScope = (param: OrgScopeParam) =>
  SetMetadata(ORG_SCOPE_KEY, param);
