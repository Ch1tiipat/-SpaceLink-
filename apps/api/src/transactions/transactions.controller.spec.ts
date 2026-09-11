import { GUARDS_METADATA } from '@nestjs/common/constants';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { UserRole } from '@prisma/client';
import { OrgScopeGuard } from '../auth/guards/org-scope.guard';
import { OrgPermissionGuard } from '../auth/guards/org-permission.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ORG_SCOPE_KEY } from '../common/decorators/org-scope.decorator';
import { ORG_PERMISSION_KEY } from '../common/decorators/org-permission.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '22222222-2222-4222-8222-222222222222';

function handler(name: 'findAll' | 'findBookingDetail'): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    TransactionsController.prototype,
    name,
  );
  if (!descriptor) throw new Error(`Missing handler: ${name}`);
  return descriptor.value as object;
}

describe('TransactionsController', () => {
  const findAll = jest.fn();
  const findBookingDetail = jest.fn();
  const controller = new TransactionsController({
    findAll,
    findBookingDetail,
  } as unknown as TransactionsService);

  beforeEach(() => jest.clearAllMocks());

  it.each(['findAll', 'findBookingDetail'] as const)(
    'protects %s with the complete organization payments guard chain',
    (name) => {
      const target = handler(name);
      expect(Reflect.getMetadata(GUARDS_METADATA, target)).toEqual([
        SupabaseAuthGuard,
        OrgScopeGuard,
        RolesGuard,
        OrgPermissionGuard,
      ]);
      expect(Reflect.getMetadata(ORG_SCOPE_KEY, target)).toBe('organizationId');
      expect(Reflect.getMetadata(ORG_PERMISSION_KEY, target)).toBe('payments');
      expect(Reflect.getMetadata(ROLES_KEY, target)).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
      ]);
    },
  );

  it('passes only guard-resolved scope and validated query to the list service', async () => {
    const query = new ListTransactionsQueryDto();
    findAll.mockResolvedValue({ items: [] });

    await controller.findAll(ORGANIZATION_ID, query);

    expect(findAll).toHaveBeenCalledWith(ORGANIZATION_ID, query);
  });

  it('passes organization and booking ids to the detail service', async () => {
    findBookingDetail.mockResolvedValue({ booking: { id: BOOKING_ID } });

    await controller.findBookingDetail(ORGANIZATION_ID, BOOKING_ID);

    expect(findBookingDetail).toHaveBeenCalledWith(ORGANIZATION_ID, BOOKING_ID);
  });
});
