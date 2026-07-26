import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateBoothDto } from './dto/create-booth.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BoothsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createBoothDto: CreateBoothDto) {
    return this.prisma.booth.create({
      data: createBoothDto as Prisma.BoothUncheckedCreateInput,
    });
  }

  findAll() {
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
