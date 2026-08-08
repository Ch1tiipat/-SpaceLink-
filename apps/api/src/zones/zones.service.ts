import { ConflictException, Injectable } from '@nestjs/common';
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
   * `orgId` comes from `@CurrentOrgId()`, which OrgScopeGuard already derived
   * from this exact zone's own organization (`zone.venue.organizationId`)
   * before the handler could run — the same value the filter below compares
   * against. It therefore cannot exclude a row the guard allowed, and it is
   * **not** a second independent check on the data.
   *
   * What it buys is a forcing function: a caller must supply an `orgId` to
   * compile, and the only sanctioned source throws InternalServerErrorException
   * the moment `@OrgScoped` is missing from the route. A route that forgets the
   * guard fails loudly at request time instead of silently running an unscoped
   * write — which is the failure §14.2 exists to prevent, and the one nobody
   * would otherwise notice.
   *
   * Should the filter ever exclude a row, Prisma raises P2025 and
   * PrismaExceptionFilter turns it into the same 404 'Resource not found' the
   * guard gives, so there is nothing to catch for that case.
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
   *
   * `Zone -> Booth` cascades, but `Booking.booth` is `onDelete: Restrict`, so
   * deleting a zone whose booths carry any booking — a CANCELLED one included —
   * is refused by the database. Left to PrismaExceptionFilter that becomes a
   * 400 'Related resource does not exist', which states the opposite of what
   * happened: the related resource exists, and that is precisely the problem.
   * Translated here for the same reason `ShopsService.assertCategoriesExist`
   * handles its own foreign-key case — the generic filter answers in English,
   * and every vendor-facing message in this codebase is Thai.
   *
   * Only the FK-restrict codes are intercepted. A missing or cross-tenant id
   * still raises P2025 and still falls through to the filter's existing 404, so
   * a caller cannot tell "not yours" from "not there" (§14.1).
   */
  async remove(id: string, orgId: string): Promise<ZoneResponse> {
    try {
      const zone = await this.prisma.zone.delete({
        where: { id, venue: { organizationId: orgId } },
        select: zoneSelect,
      });

      return this.toResponse(zone);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new ConflictException(
          'ไม่สามารถลบโซนนี้ได้เนื่องจากยังมีการจองที่เกี่ยวข้องอยู่',
        );
      }
      throw error;
    }
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
