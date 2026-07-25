import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';

/** The request shape OrgScopeGuard writes its resolved organization id onto. */
export interface OrgScopedRequest {
  organizationId?: string;
}

/**
 * Injects the organization id OrgScopeGuard resolved from the route param, so
 * a service never has to repeat the lookup. Only valid on handlers behind that
 * guard — the id is the verified one, not whatever the client sent (§14.2).
 */
export const CurrentOrgId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<OrgScopedRequest>();

    // Missing means the handler was not put behind OrgScopeGuard. Failing loudly
    // here is safer than handing a service `undefined` to filter a query by.
    if (!request.organizationId) {
      throw new InternalServerErrorException(
        'Handler uses @CurrentOrgId() without @OrgScope() and OrgScopeGuard',
      );
    }

    return request.organizationId;
  },
);
