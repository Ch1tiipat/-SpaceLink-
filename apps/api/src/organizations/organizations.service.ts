import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, OrgStatus, Prisma, UserRole } from '@prisma/client';
import {
  AUDIT_LOG_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit-logs/audit-log-actions.constant';
import {
  AuditLogsService,
  type RecordAuditLogInput,
} from '../audit-logs/audit-logs.service';
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
  constructor(
    private prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
    actorUserId: string,
  ) {
    const organization = await this.prisma.organization.create({
      data: createOrganizationDto,
      select: {
        ...PUBLIC_ORGANIZATION_SELECT,
        promptpayId: true,
      },
    });

    await this.recordAuditLogSafely({
      actorUserId,
      action: AUDIT_LOG_ACTIONS.ORGANIZATION_CREATED,
      targetType: AUDIT_TARGET_TYPES.ORGANIZATION,
      targetId: organization.id,
    });

    return organization;
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

  async updateStatus(id: string, status: OrgStatus, actorUserId: string) {
    const organization = await this.prisma.organization.update({
      where: { id },
      data: { status },
      select: PUBLIC_ORGANIZATION_SELECT,
    });

    await this.recordAuditLogSafely({
      actorUserId,
      action: AUDIT_LOG_ACTIONS.ORGANIZATION_STATUS_UPDATED,
      targetType: AUDIT_TARGET_TYPES.ORGANIZATION,
      targetId: id,
      metadata: { status },
    });

    return organization;
  }

  async listAdmins(organizationId: string) {
    return this.prisma.orgMembership.findMany({
      where: { organizationId, role: MembershipRole.ADMIN },
      select: {
        id: true,
        canEditQuota: true,
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
        canEditQuota: true,
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

  async setQuotaEditPermission(
    membershipId: string,
    canEditQuota: boolean,
    actorUserId: string,
  ) {
    const membership = await this.prisma.orgMembership.update({
      where: { id: membershipId },
      data: { canEditQuota },
    });

    await this.recordAuditLogSafely({
      actorUserId,
      action: AUDIT_LOG_ACTIONS.QUOTA_EDIT_PERMISSION_UPDATED,
      targetType: AUDIT_TARGET_TYPES.ORG_MEMBERSHIP,
      targetId: membershipId,
      metadata: { canEditQuota },
    });

    return membership;
  }

  async updateBookingQuota(
    organizationId: string,
    bookingQuotaPerVendor: number,
    currentUser: { id: string; role: UserRole },
    actorUserId: string,
  ) {
    const { updated, previousValue } = await this.prisma.$transaction(
      async (transaction) => {
        if (currentUser.role !== UserRole.SUPER_ADMIN) {
          const membership = await transaction.orgMembership.findUnique({
            where: {
              organizationId_userId: {
                organizationId,
                userId: currentUser.id,
              },
            },
            select: { canEditQuota: true },
          });
          if (!membership?.canEditQuota) {
            throw new ForbiddenException(
              'คุณไม่มีสิทธิ์แก้ไขโควตาการจองขององค์กรนี้',
            );
          }
        }

        const previous = await transaction.orgConfig.findUnique({
          where: { organizationId },
          select: { bookingQuotaPerVendor: true },
        });

        const updated = await transaction.orgConfig.upsert({
          where: { organizationId },
          create: { organizationId, bookingQuotaPerVendor },
          update: { bookingQuotaPerVendor },
        });

        return {
          updated,
          previousValue: previous?.bookingQuotaPerVendor ?? null,
        };
      },
    );

    await this.recordAuditLogSafely({
      actorUserId,
      action: AUDIT_LOG_ACTIONS.BOOKING_QUOTA_UPDATED,
      targetType: AUDIT_TARGET_TYPES.ORGANIZATION,
      targetId: organizationId,
      metadata: { from: previousValue, to: bookingQuotaPerVendor },
    });

    return updated;
  }

  async grantAdmin(organizationId: string, email: string, actorUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { membership, roleChanged } = await this.prisma.$transaction(
      async (transaction) => {
        const membership = await transaction.orgMembership.create({
          data: {
            organizationId,
            userId: user.id,
            role: MembershipRole.ADMIN,
          },
        });

        let roleChanged = false;
        if (user.role === UserRole.VENDOR) {
          await transaction.user.update({
            where: { id: user.id },
            data: { role: UserRole.ORG_ADMIN },
          });
          roleChanged = true;
        }

        return { membership, roleChanged };
      },
    );

    await this.recordAuditLogSafely({
      actorUserId,
      action: AUDIT_LOG_ACTIONS.ORG_ADMIN_GRANTED,
      targetType: AUDIT_TARGET_TYPES.USER,
      targetId: user.id,
      metadata: { organizationId, roleChanged },
    });

    return membership;
  }

  async revokeAdmin(
    organizationId: string,
    userId: string,
    actorUserId: string,
  ) {
    const roleChanged = await this.prisma.$transaction(async (transaction) => {
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

      let changed = false;
      if (remainingMemberships === 0 && user?.role === UserRole.ORG_ADMIN) {
        await transaction.user.update({
          where: { id: userId },
          data: { role: UserRole.VENDOR },
        });
        changed = true;
      }

      return changed;
    });

    await this.recordAuditLogSafely({
      actorUserId,
      action: AUDIT_LOG_ACTIONS.ORG_ADMIN_REVOKED,
      targetType: AUDIT_TARGET_TYPES.USER,
      targetId: userId,
      metadata: { organizationId, roleChanged },
    });
  }

  private async recordAuditLogSafely(
    input: RecordAuditLogInput,
  ): Promise<void> {
    await this.auditLogsService.record(input).catch(() => undefined);
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
