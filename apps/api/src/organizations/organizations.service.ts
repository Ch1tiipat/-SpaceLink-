import { Injectable } from '@nestjs/common';
import { OrgStatus, Prisma } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { PrismaService } from '../prisma/prisma.service';

export const PUBLIC_ORGANIZATION_SELECT = {
  id: true,
  name: true,
  description: true,
  contactEmail: true,
  contactPhone: true,
  logoUrl: true,
  status: true,
} satisfies Prisma.OrganizationSelect;

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    return this.prisma.organization.create({
      data: createOrganizationDto,
      select: {
        ...PUBLIC_ORGANIZATION_SELECT,
        promptpayId: true,
      },
    });
  }

  async findAll() {
    return this.prisma.organization.findMany({
      select: PUBLIC_ORGANIZATION_SELECT,
    });
  }

  async findOne(id: string) {
    return await this.prisma.organization.findUnique({
      where: { id },
      select: PUBLIC_ORGANIZATION_SELECT,
    });
  }

  update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    return this.prisma.organization.update({
      where: { id },
      data: updateOrganizationDto,
      select: {
        ...PUBLIC_ORGANIZATION_SELECT,
        promptpayId: true,
      },
    });
  }

  async updateStatus(id: string, status: OrgStatus) {
    return this.prisma.organization.update({
      where: { id },
      data: { status },
      select: PUBLIC_ORGANIZATION_SELECT,
    });
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
