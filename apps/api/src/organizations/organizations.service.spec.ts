import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipRole, OrgStatus, Prisma, UserRole } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrganizationsService,
  PUBLIC_ORGANIZATION_SELECT,
} from './organizations.service';

const organizationFindMany = jest.fn();
const organizationFindUnique = jest.fn();
const organizationCreate = jest.fn();
const organizationUpdate = jest.fn();
const userFindUnique = jest.fn();
const userUpdate = jest.fn();
const orgMembershipFindMany = jest.fn();
const orgMembershipFindUnique = jest.fn();
const orgMembershipCreate = jest.fn();
const orgMembershipUpdate = jest.fn();
const orgMembershipDelete = jest.fn();
const orgMembershipCount = jest.fn();
const orgConfigFindUnique = jest.fn();
const orgConfigUpsert = jest.fn();
const prismaTransaction = jest.fn();
const record = jest.fn();
const mockAuditLogsService = { record };
const mockPrismaService = {
  organization: {
    findMany: organizationFindMany,
    findUnique: organizationFindUnique,
    create: organizationCreate,
    update: organizationUpdate,
  },
  user: {
    findUnique: userFindUnique,
    update: userUpdate,
  },
  orgMembership: {
    findMany: orgMembershipFindMany,
    findUnique: orgMembershipFindUnique,
    create: orgMembershipCreate,
    update: orgMembershipUpdate,
    delete: orgMembershipDelete,
    count: orgMembershipCount,
  },
  orgConfig: {
    findUnique: orgConfigFindUnique,
    upsert: orgConfigUpsert,
  },
  $transaction: prismaTransaction,
};

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const ACTOR_USER_ID = '00000000-0000-4000-8000-000000000099';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000003';
const USER_EMAIL = 'admin@example.com';
const JOINED_AT = new Date('2026-08-24T00:00:00.000Z');
const MEMBERSHIP = {
  id: MEMBERSHIP_ID,
  organizationId: ORGANIZATION_ID,
  userId: USER_ID,
  role: MembershipRole.ADMIN,
  canEditQuota: false,
  joinedAt: JOINED_AT,
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    record.mockResolvedValue(undefined);

    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(mockPrismaService as unknown as Prisma.TransactionClient),
    );
    orgMembershipFindMany.mockResolvedValue([]);
    orgMembershipFindUnique.mockResolvedValue({ canEditQuota: true });
    orgMembershipCreate.mockResolvedValue(MEMBERSHIP);
    orgMembershipUpdate.mockResolvedValue(MEMBERSHIP);
    orgMembershipDelete.mockResolvedValue(MEMBERSHIP);
    orgMembershipCount.mockResolvedValue(0);
    orgConfigFindUnique.mockResolvedValue(null);
    orgConfigUpsert.mockResolvedValue({
      organizationId: ORGANIZATION_ID,
      bookingQuotaPerVendor: 3,
    });
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      email: USER_EMAIL,
      role: UserRole.VENDOR,
    });
    userUpdate.mockResolvedValue({ id: USER_ID });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an active organization with private PromptPay returned', async () => {
    const dto = {
      name: 'ตลาดนัดมหาวิทยาลัย',
      contactEmail: 'admin@example.com',
      contactPhone: '0812345678',
      promptpayId: '0812345678',
    };
    organizationCreate.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      ...dto,
      status: 'ACTIVE',
    });

    await service.create(dto, ACTOR_USER_ID);

    expect(organizationCreate).toHaveBeenCalledWith({
      data: dto,
      select: {
        ...PUBLIC_ORGANIZATION_SELECT,
        promptpayId: true,
      },
    });
    expect(record).toHaveBeenCalledWith({
      actorUserId: ACTOR_USER_ID,
      action: 'ORGANIZATION_CREATED',
      targetType: 'ORGANIZATION',
      targetId: ORGANIZATION_ID,
    });
  });

  it('never exposes promptpayId from public organization reads', async () => {
    organizationFindMany.mockResolvedValue([]);
    organizationFindUnique.mockResolvedValue(null);

    await service.findAll();
    await service.findOne('00000000-0000-4000-8000-000000000001');

    expect(PUBLIC_ORGANIZATION_SELECT).not.toHaveProperty('promptpayId');
    expect(organizationFindMany).toHaveBeenCalledWith({
      select: PUBLIC_ORGANIZATION_SELECT,
    });
    expect(organizationFindUnique).toHaveBeenCalledWith({
      where: { id: '00000000-0000-4000-8000-000000000001' },
      select: PUBLIC_ORGANIZATION_SELECT,
    });
  });

  it('updates PromptPay only on the guard-resolved organization', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    organizationUpdate.mockResolvedValue({ id, promptpayId: '0812345678' });

    await service.update(id, { promptpayId: '0812345678' });

    expect(organizationUpdate).toHaveBeenCalledWith({
      where: { id },
      data: { promptpayId: '0812345678' },
      select: {
        ...PUBLIC_ORGANIZATION_SELECT,
        promptpayId: true,
      },
    });
  });

  it('updates organization status with the public response shape', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    organizationUpdate.mockResolvedValue({
      id,
      status: OrgStatus.SUSPENDED,
    });

    await service.updateStatus(id, OrgStatus.SUSPENDED, ACTOR_USER_ID);

    expect(organizationUpdate).toHaveBeenCalledWith({
      where: { id },
      data: { status: OrgStatus.SUSPENDED },
      select: PUBLIC_ORGANIZATION_SELECT,
    });
    expect(record).toHaveBeenCalledWith({
      actorUserId: ACTOR_USER_ID,
      action: 'ORGANIZATION_STATUS_UPDATED',
      targetType: 'ORGANIZATION',
      targetId: id,
      metadata: { status: OrgStatus.SUSPENDED },
    });
  });

  it('lists organization admins with their user details', async () => {
    const admins = [
      {
        id: MEMBERSHIP_ID,
        canEditQuota: false,
        joinedAt: JOINED_AT,
        user: {
          id: USER_ID,
          email: USER_EMAIL,
          fullName: 'Admin One',
        },
      },
    ];
    orgMembershipFindMany.mockResolvedValue(admins);

    await expect(service.listAdmins(ORGANIZATION_ID)).resolves.toEqual(admins);

    expect(orgMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORGANIZATION_ID,
        role: MembershipRole.ADMIN,
      },
      select: {
        id: true,
        canEditQuota: true,
        joinedAt: true,
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });
  });

  it('returns an empty admin list when the organization has none', async () => {
    await expect(service.listAdmins(ORGANIZATION_ID)).resolves.toEqual([]);
  });

  it('lists admins across organizations with user and organization details', async () => {
    const admins = [
      {
        id: MEMBERSHIP_ID,
        canEditQuota: true,
        joinedAt: JOINED_AT,
        user: {
          id: USER_ID,
          email: USER_EMAIL,
          fullName: 'Admin One',
        },
        organization: {
          id: ORGANIZATION_ID,
          name: 'ตลาดนัดมหาวิทยาลัย',
        },
      },
    ];
    orgMembershipFindMany.mockResolvedValue(admins);

    await expect(service.listAllAdmins()).resolves.toEqual(admins);

    expect(orgMembershipFindMany).toHaveBeenCalledWith({
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
  });

  it('returns an empty cross-organization admin list when none exist', async () => {
    await expect(service.listAllAdmins()).resolves.toEqual([]);
  });

  it('updates one membership quota permission and records its audit event', async () => {
    orgMembershipUpdate.mockResolvedValue({
      ...MEMBERSHIP,
      canEditQuota: true,
    });

    await expect(
      service.setQuotaEditPermission(MEMBERSHIP_ID, true, ACTOR_USER_ID),
    ).resolves.toEqual(expect.objectContaining({ canEditQuota: true }));

    expect(orgMembershipUpdate).toHaveBeenCalledWith({
      where: { id: MEMBERSHIP_ID },
      data: { canEditQuota: true },
    });
    expect(record).toHaveBeenCalledWith({
      actorUserId: ACTOR_USER_ID,
      action: 'QUOTA_EDIT_PERMISSION_UPDATED',
      targetType: 'ORG_MEMBERSHIP',
      targetId: MEMBERSHIP_ID,
      metadata: { canEditQuota: true },
    });
    expect(orgConfigUpsert).not.toHaveBeenCalled();
  });

  it('lets the global Prisma filter handle a missing membership update', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      { code: 'P2025', clientVersion: 'test' },
    );
    orgMembershipUpdate.mockRejectedValue(notFound);

    await expect(
      service.setQuotaEditPermission(MEMBERSHIP_ID, true, ACTOR_USER_ID),
    ).rejects.toBe(notFound);

    expect(record).not.toHaveBeenCalled();
  });

  it('allows a delegated ORG_ADMIN to update an existing quota atomically', async () => {
    orgConfigFindUnique.mockResolvedValue({ bookingQuotaPerVendor: 2 });
    orgConfigUpsert.mockResolvedValue({
      organizationId: ORGANIZATION_ID,
      bookingQuotaPerVendor: 3,
    });

    await expect(
      service.updateBookingQuota(
        ORGANIZATION_ID,
        3,
        { id: USER_ID, role: UserRole.ORG_ADMIN },
        ACTOR_USER_ID,
      ),
    ).resolves.toEqual(expect.objectContaining({ bookingQuotaPerVendor: 3 }));

    expect(prismaTransaction).toHaveBeenCalledTimes(1);
    expect(orgMembershipFindUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: ORGANIZATION_ID,
          userId: USER_ID,
        },
      },
      select: { canEditQuota: true },
    });
    expect(orgConfigFindUnique).toHaveBeenCalledWith({
      where: { organizationId: ORGANIZATION_ID },
      select: { bookingQuotaPerVendor: true },
    });
    expect(orgConfigUpsert).toHaveBeenCalledWith({
      where: { organizationId: ORGANIZATION_ID },
      create: { organizationId: ORGANIZATION_ID, bookingQuotaPerVendor: 3 },
      update: { bookingQuotaPerVendor: 3 },
    });
    expect(record).toHaveBeenCalledWith({
      actorUserId: ACTOR_USER_ID,
      action: 'BOOKING_QUOTA_UPDATED',
      targetType: 'ORGANIZATION',
      targetId: ORGANIZATION_ID,
      metadata: { from: 2, to: 3 },
    });
  });

  it.each([null, { canEditQuota: false }])(
    'rejects an ORG_ADMIN without delegated quota permission (%p)',
    async (membership) => {
      orgMembershipFindUnique.mockResolvedValue(membership);

      await expect(
        service.updateBookingQuota(
          ORGANIZATION_ID,
          3,
          { id: USER_ID, role: UserRole.ORG_ADMIN },
          ACTOR_USER_ID,
        ),
      ).rejects.toThrow(
        new ForbiddenException('คุณไม่มีสิทธิ์แก้ไขโควตาการจองขององค์กรนี้'),
      );

      expect(orgConfigUpsert).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    },
  );

  it('checks the requested organization instead of any other membership', async () => {
    const otherOrganizationId = '00000000-0000-4000-8000-000000000004';
    orgMembershipFindUnique.mockResolvedValue(null);

    await expect(
      service.updateBookingQuota(
        otherOrganizationId,
        3,
        { id: USER_ID, role: UserRole.ORG_ADMIN },
        ACTOR_USER_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(orgMembershipFindUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: otherOrganizationId,
          userId: USER_ID,
        },
      },
      select: { canEditQuota: true },
    });
  });

  it('lets SUPER_ADMIN create a missing OrgConfig without a permission lookup', async () => {
    orgConfigFindUnique.mockResolvedValue(null);
    orgConfigUpsert.mockResolvedValue({
      organizationId: ORGANIZATION_ID,
      bookingQuotaPerVendor: 4,
    });

    await service.updateBookingQuota(
      ORGANIZATION_ID,
      4,
      { id: ACTOR_USER_ID, role: UserRole.SUPER_ADMIN },
      ACTOR_USER_ID,
    );

    expect(orgMembershipFindUnique).not.toHaveBeenCalled();
    expect(orgConfigUpsert).toHaveBeenCalledWith({
      where: { organizationId: ORGANIZATION_ID },
      create: { organizationId: ORGANIZATION_ID, bookingQuotaPerVendor: 4 },
      update: { bookingQuotaPerVendor: 4 },
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { from: null, to: 4 } }),
    );
  });

  it('keeps the configured quota when permission is revoked later', async () => {
    let storedQuota: number | null = null;
    orgConfigFindUnique.mockImplementation(() =>
      Promise.resolve(
        storedQuota === null ? null : { bookingQuotaPerVendor: storedQuota },
      ),
    );
    orgConfigUpsert.mockImplementation(
      ({ create }: { create: { bookingQuotaPerVendor: number } }) => {
        storedQuota = create.bookingQuotaPerVendor;
        return Promise.resolve({
          organizationId: ORGANIZATION_ID,
          bookingQuotaPerVendor: storedQuota,
        });
      },
    );

    await service.updateBookingQuota(
      ORGANIZATION_ID,
      5,
      { id: ACTOR_USER_ID, role: UserRole.SUPER_ADMIN },
      ACTOR_USER_ID,
    );
    await service.setQuotaEditPermission(MEMBERSHIP_ID, false, ACTOR_USER_ID);

    expect(storedQuota).toBe(5);
    expect(orgConfigUpsert).toHaveBeenCalledTimes(1);
  });

  it('grants admin membership and promotes a vendor atomically', async () => {
    await expect(
      service.grantAdmin(ORGANIZATION_ID, USER_EMAIL, ACTOR_USER_ID),
    ).resolves.toEqual(MEMBERSHIP);

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { email: USER_EMAIL },
    });
    expect(prismaTransaction).toHaveBeenCalledTimes(1);
    expect(orgMembershipCreate).toHaveBeenCalledWith({
      data: {
        organizationId: ORGANIZATION_ID,
        userId: USER_ID,
        role: MembershipRole.ADMIN,
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { role: UserRole.ORG_ADMIN },
    });
    expect(record).toHaveBeenCalledWith({
      actorUserId: ACTOR_USER_ID,
      action: 'ORG_ADMIN_GRANTED',
      targetType: 'USER',
      targetId: USER_ID,
      metadata: { organizationId: ORGANIZATION_ID, roleChanged: true },
    });
    expect(prismaTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      record.mock.invocationCallOrder[0],
    );
  });

  it('grants SUPER_ADMIN membership without changing the platform role', async () => {
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      email: USER_EMAIL,
      role: UserRole.SUPER_ADMIN,
    });

    await expect(
      service.grantAdmin(ORGANIZATION_ID, USER_EMAIL, ACTOR_USER_ID),
    ).resolves.toEqual(MEMBERSHIP);

    expect(orgMembershipCreate).toHaveBeenCalledTimes(1);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { organizationId: ORGANIZATION_ID, roleChanged: false },
      }),
    );
  });

  it('rejects granting admin to an unknown email', async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(
      service.grantAdmin(ORGANIZATION_ID, 'missing@example.com', ACTOR_USER_ID),
    ).rejects.toThrow(new NotFoundException('User not found'));

    expect(prismaTransaction).not.toHaveBeenCalled();
    expect(orgMembershipCreate).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('revokes the last membership and resets ORG_ADMIN to VENDOR', async () => {
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      role: UserRole.ORG_ADMIN,
    });

    await expect(
      service.revokeAdmin(ORGANIZATION_ID, USER_ID, ACTOR_USER_ID),
    ).resolves.toBeUndefined();

    expect(prismaTransaction).toHaveBeenCalledTimes(1);
    expect(orgMembershipDelete).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: ORGANIZATION_ID,
          userId: USER_ID,
        },
      },
    });
    expect(orgMembershipCount).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
    expect(userFindUnique).toHaveBeenCalledWith({ where: { id: USER_ID } });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { role: UserRole.VENDOR },
    });
    expect(record).toHaveBeenCalledWith({
      actorUserId: ACTOR_USER_ID,
      action: 'ORG_ADMIN_REVOKED',
      targetType: 'USER',
      targetId: USER_ID,
      metadata: { organizationId: ORGANIZATION_ID, roleChanged: true },
    });
    expect(prismaTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      record.mock.invocationCallOrder[0],
    );
  });

  it('keeps ORG_ADMIN when another organization membership remains', async () => {
    orgMembershipCount.mockResolvedValue(1);
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      role: UserRole.ORG_ADMIN,
    });

    await service.revokeAdmin(ORGANIZATION_ID, USER_ID, ACTOR_USER_ID);

    expect(userUpdate).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { organizationId: ORGANIZATION_ID, roleChanged: false },
      }),
    );
  });

  it('revokes SUPER_ADMIN membership without changing the platform role', async () => {
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      role: UserRole.SUPER_ADMIN,
    });

    await service.revokeAdmin(ORGANIZATION_ID, USER_ID, ACTOR_USER_ID);

    expect(orgMembershipDelete).toHaveBeenCalledTimes(1);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('still creates the organization when the audit service rejects', async () => {
    const dto = {
      name: 'ตลาดนัดมหาวิทยาลัย',
      contactEmail: 'admin@example.com',
      contactPhone: '0812345678',
      promptpayId: '0812345678',
    };
    organizationCreate.mockResolvedValue({
      id: ORGANIZATION_ID,
      ...dto,
      status: OrgStatus.ACTIVE,
    });
    record.mockRejectedValue(new Error('audit db down'));

    await expect(service.create(dto, ACTOR_USER_ID)).resolves.toMatchObject({
      id: ORGANIZATION_ID,
    });
  });
});
