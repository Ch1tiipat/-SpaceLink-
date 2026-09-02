import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatus, UserRole, type User } from '@prisma/client';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SupportTicketsController } from './support-tickets.controller';
import { SupportTicketsService } from './support-tickets.service';
import { ApproveQuotaExceptionDto } from './dto/approve-quota-exception.dto';
import {
  CreateSupportTicketDto,
  SupportTicketRequestType,
} from './dto/create-support-ticket.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const VENDOR_ID = '11111111-1111-4111-8111-111111111111';
const TICKET_ID = '22222222-2222-4222-8222-222222222222';
const ORGANIZATION_ID = '33333333-3333-4333-8333-333333333333';
const CURRENT_USER: User = {
  id: VENDOR_ID,
  authUserId: '44444444-4444-4444-8444-444444444444',
  email: 'vendor@example.com',
  fullName: 'Vendor One',
  phone: null,
  role: UserRole.VENDOR,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};
const CREATE_DTO: CreateSupportTicketDto = {
  requestType: SupportTicketRequestType.QUOTA_INCREASE,
  eventId: '55555555-5555-4555-8555-555555555555',
  zoneId: '77777777-7777-4777-8777-777777777777',
  boothId: '88888888-8888-4888-8888-888888888888',
  subject: 'ขอเพิ่มโควตาการจอง',
  message: 'ต้องการจองบูธเพิ่มอีก 1 บูธในงานนี้',
};
const APPROVE_DTO: ApproveQuotaExceptionDto = {
  eventId: '55555555-5555-4555-8555-555555555555',
  boothId: '66666666-6666-4666-8666-666666666666',
};

const create = jest.fn();
const createForOrganizationAdmin = jest.fn();
const approveQuotaException = jest.fn();
const findAllAcrossOrganizations = jest.fn();
const findOneForSuperAdmin = jest.fn();
const updateStatus = jest.fn();
const mockSupportTicketsService = {
  create,
  createForOrganizationAdmin,
  approveQuotaException,
  findAllAcrossOrganizations,
  findOneForSuperAdmin,
  updateStatus,
};

function controllerHandler(
  name:
    | 'create'
    | 'createForOrganizationAdmin'
    | 'approveQuotaException'
    | 'findAllAcrossOrganizations'
    | 'findOneForSuperAdmin'
    | 'updateStatus',
): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    SupportTicketsController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`Missing controller handler: ${name}`);
  }
  return descriptor.value as object;
}

describe('SupportTicketsController', () => {
  let controller: SupportTicketsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportTicketsController],
      providers: [
        { provide: SupportTicketsService, useValue: mockSupportTicketsService },
        // OrgScopeGuard arrives on the approval route via @OrgScoped and Nest
        // resolves it at compile time. It is never executed here — this suite
        // only inspects decorator metadata — so an empty stub is enough. The
        // guard's own behaviour is covered in org-scope.guard.spec.ts.
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<SupportTicketsController>(SupportTicketsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('leaves the cross-organization list on the class default guard', () => {
    const handler = controllerHandler('findAllAcrossOrganizations');

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
  });

  it('delegates the cross-organization list to the service', async () => {
    findAllAcrossOrganizations.mockResolvedValue([]);

    await controller.findAllAcrossOrganizations();

    expect(findAllAcrossOrganizations).toHaveBeenCalledWith();
  });

  it('loads one ticket detail using the class SUPER_ADMIN guard', async () => {
    findOneForSuperAdmin.mockResolvedValue({ id: TICKET_ID });

    await controller.findOneForSuperAdmin(TICKET_ID);

    expect(findOneForSuperAdmin).toHaveBeenCalledWith(TICKET_ID);
    expect(
      Reflect.getMetadata(ROLES_KEY, controllerHandler('findOneForSuperAdmin')),
    ).toBeUndefined();
  });

  it('passes the validated target status to the service', async () => {
    const dto: UpdateSupportTicketStatusDto = {
      status: TicketStatus.PROCESSING,
    };
    updateStatus.mockResolvedValue({
      id: TICKET_ID,
      status: TicketStatus.PROCESSING,
    });

    await controller.updateStatus(TICKET_ID, dto);

    expect(updateStatus).toHaveBeenCalledWith(
      TICKET_ID,
      TicketStatus.PROCESSING,
    );
    expect(
      Reflect.getMetadata(ROLES_KEY, controllerHandler('updateStatus')),
    ).toBeUndefined();
  });

  it('runs authentication before role authorization', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SupportTicketsController),
    ).toEqual([SupabaseAuthGuard, RolesGuard]);
  });

  it('keeps each action restricted to its intended role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SupportTicketsController)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, controllerHandler('create'))).toEqual(
      [UserRole.VENDOR],
    );
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        controllerHandler('createForOrganizationAdmin'),
      ),
    ).toEqual([UserRole.ORG_ADMIN]);
    // SUPER_ADMIN is listed explicitly because OrgScopeGuard bypasses the
    // membership check for that role — omitting it would let a super admin pass
    // OrgScopeGuard and then be rejected by RolesGuard.
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        controllerHandler('approveQuotaException'),
      ),
    ).toEqual([UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]);
  });

  // Metadata alone enforces nothing, so assert the guard travels with it: both
  // come from @OrgScoped, and a route carrying only the metadata would return
  // 200 while checking no tenant at all.
  it('puts the approval route behind OrgScopeGuard scoped to ticketId', () => {
    const handler = controllerHandler('approveQuotaException');

    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('ticketId');
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
    ]);
  });

  // A vendor raising a ticket is never org-scoped: they name an event, and the
  // service resolves the organization from it.
  it('leaves the create route unscoped', () => {
    const handler = controllerHandler('create');

    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
  });

  it('scopes organization-admin requests to the selected membership', () => {
    const handler = controllerHandler('createForOrganizationAdmin');

    expect(Reflect.getMetadata(ORG_SCOPE_KEY, handler)).toBe('organizationId');
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SupabaseAuthGuard,
      OrgScopeGuard,
    ]);
  });

  it('passes the authenticated vendor id when raising a ticket', async () => {
    create.mockResolvedValue({ id: TICKET_ID });

    await controller.create(CREATE_DTO, CURRENT_USER);

    expect(create).toHaveBeenCalledWith(CREATE_DTO, VENDOR_ID);
  });

  it('passes only authenticated and guard-resolved admin context', async () => {
    const admin = { ...CURRENT_USER, role: UserRole.ORG_ADMIN };
    createForOrganizationAdmin.mockResolvedValue({ id: TICKET_ID });

    await controller.createForOrganizationAdmin(
      CREATE_DTO,
      admin,
      ORGANIZATION_ID,
    );

    expect(createForOrganizationAdmin).toHaveBeenCalledWith(
      CREATE_DTO,
      VENDOR_ID,
      ORGANIZATION_ID,
    );
  });

  it('passes the guard-resolved organization id when approving', async () => {
    approveQuotaException.mockResolvedValue({ id: 'booking-id' });

    await controller.approveQuotaException(
      TICKET_ID,
      APPROVE_DTO,
      ORGANIZATION_ID,
    );

    expect(approveQuotaException).toHaveBeenCalledWith(
      TICKET_ID,
      APPROVE_DTO,
      ORGANIZATION_ID,
    );
  });
});
