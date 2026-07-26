import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createVenueDto: CreateVenueDto) {
    return this.prisma.venue.create({
      data: createVenueDto as Prisma.VenueUncheckedCreateInput,
    });
  }

  findAll() {
    return this.prisma.venue.findMany();
  }

  findOne(id: string) {
    return this.prisma.venue.findUnique({
      where: { id },
    });
  }

  update(id: string, updateVenueDto: UpdateVenueDto) {
    return this.prisma.venue.update({
      where: { id },
      data: updateVenueDto,
    });
  }

  remove(id: string) {
    return this.prisma.venue.delete({
      where: { id },
    });
  }
}
