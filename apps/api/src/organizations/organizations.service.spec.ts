import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipRole, OrgStatus, Prisma, UserRole } from '@prisma/client';
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
const orgMembershipCreate = jest.fn();
const orgMembershipDelete = jest.fn();
const orgMembershipCount = jest.fn();
const prismaTransaction = jest.fn();
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
    create: orgMembershipCreate,
    delete: orgMembershipDelete,
    count: orgMembershipCount,
  },
  $transaction: prismaTransaction,
};

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000003';
const USER_EMAIL = 'admin@example.com';
const JOINED_AT = new Date('2026-08-24T00:00:00.000Z');
const MEMBERSHIP = {
  id: MEMBERSHIP_ID,
  organizationId: ORGANIZATION_ID,
  userId: USER_ID,
  role: MembershipRole.ADMIN,
  joinedAt: JOINED_AT,
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaTransaction.mockImplementation(
      (operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        operation(mockPrismaService as unknown as Prisma.TransactionClient),
    );
    orgMembershipFindMany.mockResolvedValue([]);
    orgMembershipCreate.mockResolvedValue(MEMBERSHIP);
    orgMembershipDelete.mockResolvedValue(MEMBERSHIP);
    orgMembershipCount.mockResolvedValue(0);
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

    await service.create(dto);

    expect(organizationCreate).toHaveBeenCalledWith({
      data: dto,
      select: {
        ...PUBLIC_ORGANIZATION_SELECT,
        promptpayId: true,
      },
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

    await service.updateStatus(id, OrgStatus.SUSPENDED);

    expect(organizationUpdate).toHaveBeenCalledWith({
      where: { id },
      data: { status: OrgStatus.SUSPENDED },
      select: PUBLIC_ORGANIZATION_SELECT,
    });
  });

  it('lists organization admins with their user details', async () => {
    const admins = [
      {
        id: MEMBERSHIP_ID,
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

  it('grants admin membership and promotes a vendor atomically', async () => {
    await expect(
      service.grantAdmin(ORGANIZATION_ID, USER_EMAIL),
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
  });

  it('grants SUPER_ADMIN membership without changing the platform role', async () => {
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      email: USER_EMAIL,
      role: UserRole.SUPER_ADMIN,
    });

    await expect(
      service.grantAdmin(ORGANIZATION_ID, USER_EMAIL),
    ).resolves.toEqual(MEMBERSHIP);

    expect(orgMembershipCreate).toHaveBeenCalledTimes(1);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('rejects granting admin to an unknown email', async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(
      service.grantAdmin(ORGANIZATION_ID, 'missing@example.com'),
    ).rejects.toThrow(new NotFoundException('User not found'));

    expect(prismaTransaction).not.toHaveBeenCalled();
    expect(orgMembershipCreate).not.toHaveBeenCalled();
  });

  it('revokes the last membership and resets ORG_ADMIN to VENDOR', async () => {
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      role: UserRole.ORG_ADMIN,
    });

    await expect(
      service.revokeAdmin(ORGANIZATION_ID, USER_ID),
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
  });

  it('keeps ORG_ADMIN when another organization membership remains', async () => {
    orgMembershipCount.mockResolvedValue(1);
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      role: UserRole.ORG_ADMIN,
    });

    await service.revokeAdmin(ORGANIZATION_ID, USER_ID);

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('revokes SUPER_ADMIN membership without changing the platform role', async () => {
    userFindUnique.mockResolvedValue({
      id: USER_ID,
      role: UserRole.SUPER_ADMIN,
    });

    await service.revokeAdmin(ORGANIZATION_ID, USER_ID);

    expect(orgMembershipDelete).toHaveBeenCalledTimes(1);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
