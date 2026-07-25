import { UseGuards, applyDecorators } from '@nestjs/common';
import { OrgScope } from '../../common/decorators/org-scope.decorator';
import type { OrgScopeParam } from '../../common/decorators/org-scope.decorator';
import { OrgScopeGuard } from '../guards/org-scope.guard';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';

/**
 * Puts a handler behind the full org-scope chain: authenticate, then resolve
 * the route param to an organization and check membership in our database.
 *
 * ```ts
 * @Get(':venueId')
 * @OrgScoped('venueId')
 * findOne(@Param('venueId') venueId: string, @CurrentOrgId() orgId: string) {}
 * ```
 *
 * **Use this rather than `@OrgScope` + `@UseGuards`, and never take it apart.**
 *
 * `@OrgScope` on its own is metadata. Metadata does not enforce anything — it
 * sits there waiting for OrgScopeGuard to read it, and if the guard was never
 * put on the route, nothing ever does. That failure is silent in every way that
 * normally catches a mistake: it compiles, the tests pass, the endpoint returns
 * 200, and the only thing wrong is that any authenticated vendor can now read
 * another organization's data. There is no error to notice, because from the
 * application's point of view nothing went wrong.
 *
 * The guard cannot close this itself. Registered globally as an APP_GUARD it
 * would run *before* the route-level SupabaseAuthGuard — Nest runs global
 * guards first — reach `canActivate` with no `request.user`, and 401 every
 * scoped route. The order matters, so the two guards have to be named together
 * on the route, which is exactly what this decorator does and why splitting it
 * back apart is not a refactor.
 *
 * Guard order is the chain in CLAUDE.md §7: SupabaseAuthGuard (verify token,
 * provision `app_user`) → OrgScopeGuard (resolve organization, check
 * OrgMembership). `@Roles`/RolesGuard, where a route needs one, goes between
 * them via its own `@UseGuards` — this decorator deliberately does not bundle a
 * role check, because most org-scoped routes are open to both OWNER and ADMIN.
 */
export function OrgScoped(param: OrgScopeParam) {
  return applyDecorators(
    UseGuards(SupabaseAuthGuard, OrgScopeGuard),
    OrgScope(param),
  );
}
