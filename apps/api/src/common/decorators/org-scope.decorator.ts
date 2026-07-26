import { SetMetadata } from '@nestjs/common';

export const ORG_SCOPE_KEY = 'orgScope';

/**
 * The route params OrgScopeGuard knows how to resolve to an organization.
 * Each one is a step on the ownership chain (AGENTS.md §5):
 * Organization -> Venue -> Zone -> Booth, with Event hanging off Organization.
 */
export type OrgScopeParam =
  'organizationId' | 'venueId' | 'eventId' | 'zoneId' | 'boothId';

/**
 * Marks a handler as org-scoped, naming the route param that identifies the
 * resource. Read by OrgScopeGuard, which resolves it to an organization and
 * checks membership in our database.
 *
 * **On a route, use `@OrgScoped(param)` from `src/auth/decorators` instead.**
 * This decorator only records metadata; the guard that acts on it has to be put
 * on the route separately, and a route carrying the metadata without the guard
 * enforces nothing while looking exactly like one that does. `@OrgScoped`
 * applies both together so they cannot be separated by accident.
 *
 * Kept exported because `@OrgScoped` is built from it, and because OrgScopeGuard
 * reads the key it sets.
 */
export const OrgScope = (param: OrgScopeParam) =>
  SetMetadata(ORG_SCOPE_KEY, param);
