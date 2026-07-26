import { Controller, Get } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

/*
 * `jose` ships ESM only, and importing SupabaseAuthGuard reaches it through
 * SupabaseTokenService — which this suite never runs, it only checks which
 * guard classes the decorator attached. Stubbing the module keeps that import
 * loadable under the CommonJS jest setup. Any future suite that touches the
 * auth guards for real will need a jest/ESM configuration instead.
 */
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { ORG_SCOPE_KEY } from '../../common/decorators/org-scope.decorator';
import { OrgScope } from '../../common/decorators/org-scope.decorator';
import { OrgScopeGuard } from '../guards/org-scope.guard';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';
import { OrgScoped } from './org-scoped.decorator';

/** What `@UseGuards` stores on a handler. */
function guardsOn(handler: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) ?? [];
}

function orgScopeParamOn(handler: object): unknown {
  return Reflect.getMetadata(ORG_SCOPE_KEY, handler);
}

@Controller('venues')
class ScopedController {
  @Get(':venueId')
  @OrgScoped('venueId')
  // `this: void` is type-only and erased at compile: it says the handler never
  // touches `this`, so the tests may read it off the prototype detached from
  // its instance. Same annotation the OrgScopeGuard suite uses.
  findOne(this: void): string {
    return 'ok';
  }
}

@Controller('venues')
class MetadataOnlyController {
  @Get(':venueId')
  @OrgScope('venueId')
  findOne(this: void): string {
    return 'ok';
  }
}

describe('@OrgScoped', () => {
  it('names the route param OrgScopeGuard will resolve', () => {
    expect(orgScopeParamOn(ScopedController.prototype.findOne)).toBe('venueId');
  });

  /*
   * The whole point of the decorator: one application puts BOTH guards on the
   * route. Drop either name from `applyDecorators` and this fails — which is
   * the compiler error the metadata itself cannot give us.
   */
  it('applies SupabaseAuthGuard and OrgScopeGuard together', () => {
    expect(guardsOn(ScopedController.prototype.findOne)).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
    ]);
  });

  /*
   * Order is not decoration. Nest runs guards in the order given, and
   * OrgScopeGuard reads `request.user` that SupabaseAuthGuard puts there — so
   * reversing these two turns every scoped route into a 401.
   */
  it('runs SupabaseAuthGuard before OrgScopeGuard', () => {
    const guards = guardsOn(ScopedController.prototype.findOne);

    expect(guards.indexOf(SupabaseAuthGuard)).toBeLessThan(
      guards.indexOf(OrgScopeGuard),
    );
  });

  /*
   * The trap this decorator exists to close, pinned as an executable statement
   * rather than a comment: @OrgScope alone enforces nothing at all. If a future
   * change ever makes the bare decorator self-enforcing, this test fails and
   * whoever made that change gets to delete it deliberately.
   */
  it('is not what @OrgScope alone does — that leaves the route unguarded', () => {
    const handler = MetadataOnlyController.prototype.findOne;

    expect(orgScopeParamOn(handler)).toBe('venueId');
    expect(guardsOn(handler)).toEqual([]);
  });
});
