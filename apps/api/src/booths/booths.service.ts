import { Injectable } from '@nestjs/common';
import { CreateBoothDto } from './dto/create-booth.dto';
import { FindAllBoothsDto } from './dto/find-all-booths.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BoothsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `zoneId` is the id `OrgScopeGuard` already resolved and verified from the
   * `:zoneId` route param on the caller — it is never taken from
   * `createBoothDto`, which has no `zoneId` field at all.
   */
  create(zoneId: string, createBoothDto: CreateBoothDto) {
    return this.prisma.booth.create({
      data: { ...createBoothDto, zoneId },
    });
  }

  findAll(query: FindAllBoothsDto = {}) {
    if (query.zoneId) {
      return this.prisma.booth.findMany({
        where: { zoneId: query.zoneId },
      });
    }

    return this.prisma.booth.findMany();
  }

  findOne(id: string) {
    return this.prisma.booth.findUnique({
      where: { id },
    });
  }

  update(id: string, updateBoothDto: UpdateBoothDto) {
    return this.prisma.booth.update({
      where: { id },
      data: updateBoothDto,
    });
  }

  remove(id: string) {
    return this.prisma.booth.delete({
      where: { id },
    });
  }
}
