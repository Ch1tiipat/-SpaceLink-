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
 * Guard order is the chain in AGENTS.md §7: SupabaseAuthGuard (verify token,
 * provision `app_user`) → OrgScopeGuard (resolve organization, check
 * OrgMembership). This decorator deliberately does not bundle a role check,
 * because most org-scoped routes are open to more than one role.
 *
 * **Adding `@Roles`/RolesGuard cannot literally land it between the two guards
 * above.** `UseGuards(SupabaseAuthGuard, OrgScopeGuard)` always lands as one
 * adjacent pair (that's the point of this decorator), so a separate
 * `@UseGuards(RolesGuard)` can only end up entirely before that pair or
 * entirely after it — never sliced into the middle. Putting it before throws:
 * RolesGuard would run with no `request.user` yet. The only safe placement is
 * after, which resolves to `[SupabaseAuthGuard, OrgScopeGuard, RolesGuard]`:
 *
 * ```ts
 * @Patch(':zoneId')
 * @UseGuards(RolesGuard)
 * @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
 * @OrgScoped('zoneId')
 * update(...) {}
 * ```
 *
 * This is still correct: SupabaseAuthGuard always runs first, so both
 * OrgScopeGuard and RolesGuard have `request.user` by the time they run, and
 * the two check independent things (tenant membership vs. platform role) so
 * their order relative to each other doesn't change the outcome — only that
 * a wrong-role request pays for one extra membership lookup before being
 * rejected. Include SUPER_ADMIN in `@Roles` on any route using this pattern:
 * OrgScopeGuard already bypasses the membership check for that role, so
 * leaving it out of `@Roles` would let a super admin pass OrgScopeGuard and
 * then get wrongly rejected by RolesGuard.
 */
export function OrgScoped(param: OrgScopeParam) {
  return applyDecorators(
    UseGuards(SupabaseAuthGuard, OrgScopeGuard),
    OrgScope(param),
  );
}
