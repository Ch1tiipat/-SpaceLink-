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

  update(id: string, updateZoneDto: UpdateZoneDto) {
    return this.prisma.zone.update({
      where: { id },
      data: updateZoneDto,
    });
  }

  remove(id: string) {
    return this.prisma.zone.delete({
      where: { id },
    });
  }
}
