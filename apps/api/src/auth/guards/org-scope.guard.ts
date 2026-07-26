import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User, UserRole } from '@prisma/client';
import { isUUID } from 'class-validator';
import type { OrgScopedRequest } from '../../common/decorators/current-org-id.decorator';
import {
  ORG_SCOPE_KEY,
  OrgScopeParam,
} from '../../common/decorators/org-scope.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface OrgScopeRequest extends OrgScopedRequest {
  params?: Record<string, string | undefined>;
  user?: User;
}

/**
 * The single message for both "no such resource" and "not yours" — one const so
 * the two cannot drift apart and start telling the two situations apart.
 */
const RESOURCE_NOT_FOUND = 'Resource not found';

/**
 * Last guard in the chain (AGENTS.md §7, step 6). Takes the resource id from
 * the route, walks the ownership chain to the organization that owns it, and
 * refuses the request unless the caller is a member of that organization.
 *
 * The organization is never taken from the request itself (§14.2): a client
 * saying `orgId=X` proves nothing, so even `@OrgScope('organizationId')` is
 * checked against OrgMembership before anything is read or written. Role and
 * membership both come from our database, never from a token claim.
 *
 * A resource in another organization answers 404, exactly as a resource that
 * does not exist (§14.1): 403 would confirm the id is real and let anyone walk
 * the id space of every other tenant. The distinction is kept server-side in a
 * warning log, never in the response.
 *
 * The resolved id is left on the request for @CurrentOrgId() to pick up, so a
 * service behind this guard does not repeat the query.
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  private readonly logger = new Logger(OrgScopeGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const param = this.reflector.getAllAndOverride<OrgScopeParam | undefined>(
      ORG_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Not an org-scoped route.
    if (!param) {
      return true;
    }

    const request = context.switchToHttp().getRequest<OrgScopeRequest>();
    const user = request.user;

    // Nest runs guards in the order given to @UseGuards, so an @OrgScope route
    // without SupabaseAuthGuard ahead of it reaches here with no user. Say that
    // plainly rather than dereferencing undefined.
    if (!user) {
      throw new UnauthorizedException(
        '@OrgScope requires SupabaseAuthGuard to run first',
      );
    }

    const resourceId = request.params?.[param];

    if (!resourceId || !isUUID(resourceId)) {
      throw new BadRequestException(`Route param ${param} must be a UUID`);
    }

    const organizationId = await this.resolveOrganizationId(param, resourceId);

    if (user.role !== UserRole.SUPER_ADMIN) {
      const membership = await this.prisma.orgMembership.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: user.id },
        },
        select: { id: true },
      });

      if (!membership) {
        // The only place the two 404s are told apart. Ids only — no token, no
        // email (§14.3, §14.5).
        this.logger.warn(
          `Org scope denied: user ${user.id} is not a member of organization ` +
            `${organizationId} (${param}=${resourceId}); answered 404`,
        );
        throw new NotFoundException(RESOURCE_NOT_FOUND);
      }
    }

    request.organizationId = organizationId;

    return true;
  }

  /**
   * One query per case, selecting only the ids needed to walk the chain.
   * A resource that does not exist is a 404 — including an unknown
   * organization, which is why `organizationId` is looked up rather than
   * trusted as given.
   */
  private async resolveOrganizationId(
    param: OrgScopeParam,
    id: string,
  ): Promise<string> {
    switch (param) {
      case 'organizationId': {
        const organization = await this.prisma.organization.findUnique({
          where: { id },
          select: { id: true },
        });
        return this.orFail(organization?.id);
      }
      case 'venueId': {
        const venue = await this.prisma.venue.findUnique({
          where: { id },
          select: { organizationId: true },
        });
        return this.orFail(venue?.organizationId);
      }
      case 'eventId': {
        const event = await this.prisma.event.findUnique({
          where: { id },
          select: { organizationId: true },
        });
        return this.orFail(event?.organizationId);
      }
      case 'zoneId': {
        const zone = await this.prisma.zone.findUnique({
          where: { id },
          select: { venue: { select: { organizationId: true } } },
        });
        return this.orFail(zone?.venue.organizationId);
      }
      case 'boothId': {
        const booth = await this.prisma.booth.findUnique({
          where: { id },
          select: {
            zone: { select: { venue: { select: { organizationId: true } } } },
          },
        });
        return this.orFail(booth?.zone.venue.organizationId);
      }
    }
  }

  private orFail(organizationId: string | undefined): string {
    if (!organizationId) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    return organizationId;
  }
}
