import { Injectable } from '@nestjs/common';
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
   * `orgId` is the id OrgScopeGuard resolved and verified, taken from the
   * request by `@CurrentOrgId()` — never from the client (§14.2). One relation
   * level deeper than the zone case: booth -> zone -> venue -> organization.
   *
   * See ZonesService.update for why no error handling belongs here — a row in
   * another organization does not match, and PrismaExceptionFilter turns the
   * resulting P2025 into the same 404 the guard would have given.
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
   */
  async remove(id: string, orgId: string): Promise<BoothResponse> {
    const booth = await this.prisma.booth.delete({
      where: { id, zone: { venue: { organizationId: orgId } } },
      select: boothSelect,
    });

    return this.toResponse(booth);
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
