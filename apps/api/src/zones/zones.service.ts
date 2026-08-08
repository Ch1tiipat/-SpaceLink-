import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateZoneDto } from './dto/create-zone.dto';
import { FindAllZonesDto } from './dto/find-all-zones.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { decimalString } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';

/**
 * One projection for every zone response, so a zone looks identical whether it
 * came back from a read or from a write. Same pattern as `shopSelect` in
 * ShopsService.
 */
const zoneSelect = {
  id: true,
  venueId: true,
  code: true,
  name: true,
  description: true,
  defaultBoothPrice: true,
  posX: true,
  posY: true,
  imageUrls: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ZoneSelect;

type ZoneRecord = Prisma.ZoneGetPayload<{ select: typeof zoneSelect }>;

export interface ZoneResponse {
  id: string;
  venueId: string;
  code: string;
  name: string | null;
  description: string | null;
  /** Decimal columns cross the boundary as strings, never floats (§6.1). */
  defaultBoothPrice: string | null;
  posX: string | null;
  posY: string | null;
  /**
   * Nothing in the API or the web app reads this yet and the schema is frozen,
   * so there is no established shape to type it as. Kept in the contract rather
   * than dropped — narrowing a response because no consumer exists today is a
   * silent break for whichever one arrives tomorrow.
   */
  imageUrls: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `venueId` is the id `OrgScopeGuard` already resolved and verified from the
   * `:venueId` route param on the caller (`VenuesController.createZone`) — it
   * is never taken from `createZoneDto`, which has no `venueId` field at all.
   */
  async create(
    venueId: string,
    createZoneDto: CreateZoneDto,
  ): Promise<ZoneResponse> {
    const zone = await this.prisma.zone.create({
      data: { ...createZoneDto, venueId },
      select: zoneSelect,
    });

    return this.toResponse(zone);
  }

  async findAll(query: FindAllZonesDto = {}): Promise<ZoneResponse[]> {
    const zones = await this.prisma.zone.findMany({
      where: query.venueId ? { venueId: query.venueId } : undefined,
      select: zoneSelect,
    });

    return zones.map((zone) => this.toResponse(zone));
  }

  /**
   * A miss stays `null` rather than becoming a 404: this is a public read that
   * already behaves that way, and changing it is a contract change neither
   * ticket asked for.
   */
  async findOne(id: string): Promise<ZoneResponse | null> {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      select: zoneSelect,
    });

    return zone ? this.toResponse(zone) : null;
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
  async update(
    id: string,
    updateZoneDto: UpdateZoneDto,
    orgId: string,
  ): Promise<ZoneResponse> {
    const zone = await this.prisma.zone.update({
      where: { id, venue: { organizationId: orgId } },
      data: updateZoneDto,
      select: zoneSelect,
    });

    return this.toResponse(zone);
  }

  /**
   * Returns the row as it was immediately before deletion — the same shape
   * every other method returns, which is also what this endpoint returned
   * before it had a response type.
   */
  async remove(id: string, orgId: string): Promise<ZoneResponse> {
    const zone = await this.prisma.zone.delete({
      where: { id, venue: { organizationId: orgId } },
      select: zoneSelect,
    });

    return this.toResponse(zone);
  }

  private toResponse(zone: ZoneRecord): ZoneResponse {
    return {
      id: zone.id,
      venueId: zone.venueId,
      code: zone.code,
      name: zone.name,
      description: zone.description,
      defaultBoothPrice: decimalString(zone.defaultBoothPrice),
      posX: decimalString(zone.posX),
      posY: decimalString(zone.posY),
      imageUrls: zone.imageUrls,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt,
    };
  }
}
