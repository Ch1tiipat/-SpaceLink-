import { Injectable } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  // TODO(SCRUM-24): implement Prisma create/update
  create(_createOrganizationDto: CreateOrganizationDto) {
    return 'This action adds a new organization';
  }

  async findAll() {
    return await this.prisma.organization.findMany();
  }

  async findOne(id: string) {
    return await this.prisma.organization.findUnique({
      where: { id },
    });
  }

  // TODO(SCRUM-24): implement Prisma create/update
  update(id: number, _updateOrganizationDto: UpdateOrganizationDto) {
    return `This action updates a #${id} organization`;
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
