import { Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, OrgStatus, Prisma, UserRole } from '@prisma/client';
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

  async listAdmins(organizationId: string) {
    return this.prisma.orgMembership.findMany({
      where: { organizationId, role: MembershipRole.ADMIN },
      select: {
        id: true,
        joinedAt: true,
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });
  }

  async listAllAdmins() {
    return this.prisma.orgMembership.findMany({
      where: { role: MembershipRole.ADMIN },
      select: {
        id: true,
        joinedAt: true,
        user: {
          select: { id: true, email: true, fullName: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async grantAdmin(organizationId: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.orgMembership.create({
        data: {
          organizationId,
          userId: user.id,
          role: MembershipRole.ADMIN,
        },
      });

      if (user.role === UserRole.VENDOR) {
        await transaction.user.update({
          where: { id: user.id },
          data: { role: UserRole.ORG_ADMIN },
        });
      }

      return membership;
    });
  }

  async revokeAdmin(organizationId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.orgMembership.delete({
        where: {
          organizationId_userId: { organizationId, userId },
        },
      });

      const remainingMemberships = await transaction.orgMembership.count({
        where: { userId },
      });
      const user = await transaction.user.findUnique({
        where: { id: userId },
      });

      if (remainingMemberships === 0 && user?.role === UserRole.ORG_ADMIN) {
        await transaction.user.update({
          where: { id: userId },
          data: { role: UserRole.VENDOR },
        });
      }
    });
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
