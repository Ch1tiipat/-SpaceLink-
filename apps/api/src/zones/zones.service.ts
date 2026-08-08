import { Injectable } from '@nestjs/common';
import { CreateZoneDto } from './dto/create-zone.dto';
import { FindAllZonesDto } from './dto/find-all-zones.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `venueId` is the id `OrgScopeGuard` already resolved and verified from the
   * `:venueId` route param on the caller (`VenuesController.createZone`) — it
   * is never taken from `createZoneDto`, which has no `venueId` field at all.
   */
  create(venueId: string, createZoneDto: CreateZoneDto) {
    return this.prisma.zone.create({
      data: { ...createZoneDto, venueId },
    });
  }

  findAll(query: FindAllZonesDto = {}) {
    if (query.venueId) {
      return this.prisma.zone.findMany({
        where: { venueId: query.venueId },
      });
    }

    return this.prisma.zone.findMany();
  }

  findOne(id: string) {
    return this.prisma.zone.findUnique({
      where: { id },
    });
  }

  /**
   * `orgId` is the id OrgScopeGuard resolved and verified, taken from the
   * request by `@CurrentOrgId()` — never from the client (§14.2).
   *
   * The guard has already checked membership, so the filter here is defence in
   * depth rather than the only check: it keeps the promise in §14.2 that every
   * org-scoped query names the org relation explicitly. A row in another
   * organization simply does not match, Prisma raises P2025, and
   * PrismaExceptionFilter turns that into the same 404 'Resource not found'
   * the guard would have given — so there is nothing to catch here.
   */
  update(id: string, updateZoneDto: UpdateZoneDto, orgId: string) {
    return this.prisma.zone.update({
      where: { id, venue: { organizationId: orgId } },
      data: updateZoneDto,
    });
  }

  remove(id: string, orgId: string) {
    return this.prisma.zone.delete({
      where: { id, venue: { organizationId: orgId } },
    });
  }
}
