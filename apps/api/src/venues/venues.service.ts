import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, VenueStatus } from '@prisma/client';
import { CreateVenueDto } from './dto/create-venue.dto';
import { FindAllVenuesDto } from './dto/find-all-venues.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createVenueDto: CreateVenueDto, organizationId: string) {
    return this.prisma.venue.create({
      // Explicit because the frozen schema defaults to ACTIVE.
      data: { ...createVenueDto, organizationId, status: VenueStatus.DRAFT },
    });
  }

  findAll(query: FindAllVenuesDto = {}) {
    if (query.organizationId) {
      return this.prisma.venue.findMany({
        where: { organizationId: query.organizationId },
      });
    }

    return this.prisma.venue.findMany();
  }

  findOne(id: string) {
    return this.prisma.venue.findUnique({
      where: { id },
    });
  }

  update(id: string, updateVenueDto: UpdateVenueDto, orgId: string) {
    return this.prisma.venue.update({
      where: { id, organizationId: orgId },
      data: updateVenueDto,
    });
  }

  async remove(id: string, orgId: string) {
    try {
      return await this.prisma.venue.delete({
        where: { id, organizationId: orgId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new ConflictException(
          'ไม่สามารถลบสถานที่นี้ได้เนื่องจากยังมีโซนหรือการจองที่เกี่ยวข้องอยู่',
        );
      }
      throw error;
    }
  }
}
