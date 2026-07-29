import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateZoneDto } from './dto/create-zone.dto';
import { FindAllZonesDto } from './dto/find-all-zones.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createZoneDto: CreateZoneDto) {
    return this.prisma.zone.create({
      data: createZoneDto as Prisma.ZoneUncheckedCreateInput,
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
