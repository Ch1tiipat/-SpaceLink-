import { ConflictException, Injectable } from '@nestjs/common';
import { BoothStatus, Prisma } from '@prisma/client';
import { CreateBoothDto } from './dto/create-booth.dto';
import { FindAllBoothsDto } from './dto/find-all-booths.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';
import { decimalString } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';

/**
 * One projection for every booth response, so a booth looks identical whether
 * it came back from a read or from a write. Same pattern as `shopSelect` in
 * ShopsService.
 */
const boothSelect = {
  id: true,
  zoneId: true,
  code: true,
  boothPrice: true,
  widthM: true,
  heightM: true,
  facilities: true,
  posX: true,
  posY: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BoothSelect;

type BoothRecord = Prisma.BoothGetPayload<{ select: typeof boothSelect }>;

export interface BoothResponse {
  id: string;
  zoneId: string;
  code: string;
  /** Required in the schema, so `string` — not `string | null` (§6.1). */
  boothPrice: string;
  widthM: string | null;
  heightM: string | null;
  /**
   * Nothing in the API or the web app reads this yet and the schema is frozen,
   * so there is no established shape to type it as. Kept in the contract rather
   * than dropped — narrowing a response because no consumer exists today is a
   * silent break for whichever one arrives tomorrow.
   */
  facilities: Prisma.JsonValue | null;
  posX: string | null;
  posY: string | null;
  status: BoothStatus;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BoothsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `zoneId` is the id `OrgScopeGuard` already resolved and verified from the
   * `:zoneId` route param on the caller — it is never taken from
   * `createBoothDto`, which has no `zoneId` field at all.
   */
  async create(
    zoneId: string,
    createBoothDto: CreateBoothDto,
  ): Promise<BoothResponse> {
    const booth = await this.prisma.booth.create({
      data: { ...createBoothDto, zoneId },
      select: boothSelect,
    });

    return this.toResponse(booth);
  }

  async findAll(query: FindAllBoothsDto = {}): Promise<BoothResponse[]> {
    const booths = await this.prisma.booth.findMany({
      where: query.zoneId ? { zoneId: query.zoneId } : undefined,
      select: boothSelect,
    });

    return booths.map((booth) => this.toResponse(booth));
  }

  /**
   * A miss stays `null` rather than becoming a 404: this is a public read that
   * already behaves that way, and changing it is a contract change neither
   * ticket asked for.
   */
  async findOne(id: string): Promise<BoothResponse | null> {
    const booth = await this.prisma.booth.findUnique({
      where: { id },
      select: boothSelect,
    });

    return booth ? this.toResponse(booth) : null;
  }

  /**
   * `orgId` comes from `@CurrentOrgId()`, which OrgScopeGuard already derived
   * from this exact booth's own organization — one relation level deeper than
   * the zone case, `booth.zone.venue.organizationId` — before the handler could
   * run. It is the same value the filter below compares against, so the filter
   * cannot exclude a row the guard allowed and is **not** a second independent
   * check on the data.
   *
   * What it buys is a forcing function: a caller must supply an `orgId` to
   * compile, and the only sanctioned source throws InternalServerErrorException
   * the moment `@OrgScoped` is missing from the route, so a route that forgets
   * the guard fails loudly instead of silently running an unscoped write
   * (§14.2). See ZonesService.update for the longer version.
   */
  async update(
    id: string,
    updateBoothDto: UpdateBoothDto,
    orgId: string,
  ): Promise<BoothResponse> {
    const booth = await this.prisma.booth.update({
      where: { id, zone: { venue: { organizationId: orgId } } },
      data: updateBoothDto,
      select: boothSelect,
    });

    return this.toResponse(booth);
  }

  /**
   * Returns the row as it was immediately before deletion — the same shape
   * every other method returns, which is also what this endpoint returned
   * before it had a response type.
   *
   * `Booking.booth` is `onDelete: Restrict`, so a booth with any booking
   * against it — a CANCELLED one included — cannot be deleted. Left to
   * PrismaExceptionFilter that becomes a 400 'Related resource does not exist',
   * which states the opposite of what happened. See ZonesService.remove for the
   * full reasoning; the difference here is only that the booth is refused
   * directly rather than through a cascade from its zone.
   *
   * Only the FK-restrict codes are intercepted. A missing or cross-tenant id
   * still raises P2025 and still falls through to the filter's existing 404
   * (§14.1).
   */
  async remove(id: string, orgId: string): Promise<BoothResponse> {
    try {
      const booth = await this.prisma.booth.delete({
        where: { id, zone: { venue: { organizationId: orgId } } },
        select: boothSelect,
      });

      return this.toResponse(booth);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new ConflictException(
          'ไม่สามารถลบบูธนี้ได้เนื่องจากยังมีการจองที่เกี่ยวข้องอยู่',
        );
      }
      throw error;
    }
  }

  private toResponse(booth: BoothRecord): BoothResponse {
    return {
      id: booth.id,
      zoneId: booth.zoneId,
      code: booth.code,
      boothPrice: booth.boothPrice.toString(),
      widthM: decimalString(booth.widthM),
      heightM: decimalString(booth.heightM),
      facilities: booth.facilities,
      posX: decimalString(booth.posX),
      posY: decimalString(booth.posY),
      status: booth.status,
      createdAt: booth.createdAt,
      updatedAt: booth.updatedAt,
    };
  }
}
