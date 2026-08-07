import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, type User } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const USER_ID = '00000000-0000-4000-8000-000000000001';
const CURRENT_USER: User = {
  id: USER_ID,
  authUserId: '00000000-0000-4000-8000-000000000002',
  email: 'vendor@example.com',
  fullName: 'Vendor One',
  phone: null,
  role: UserRole.VENDOR,
  isBlacklisted: false,
  blacklistReason: 'must stay private',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const userUpdate = jest.fn();
const mockPrismaService = { user: { update: userUpdate } };

function handlerOf(name: string): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    UsersController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`Missing controller handler: ${name}`);
  }
  return descriptor.value as object;
}

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    userUpdate.mockResolvedValue({ ...CURRENT_USER, phone: '0812345678' });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /*
   * Retitled in SCRUM-59: the controller is no longer read-only now that
   * PATCH /users/me exists. What still holds is the class default and the
   * absence of the scaffolded admin write handlers, which is what this asserts.
   */
  it('defaults to super admins and exposes no admin write handlers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
    expect(UsersController.prototype).not.toHaveProperty('create');
    expect(UsersController.prototype).not.toHaveProperty('update');
    expect(UsersController.prototype).not.toHaveProperty('remove');
  });

  /*
   * The load-bearing assertion of this phase. RolesGuard reads ROLES_KEY with
   * getAllAndOverride, so the handler list replaces the class list rather than
   * adding to it: drop or shorten this decorator and vendors silently lose
   * access to their own profile while the route keeps returning 200 for admins.
   */
  it('opens PATCH /users/me to all three roles', () => {
    expect(Reflect.getMetadata(ROLES_KEY, handlerOf('updateMe'))).toEqual([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
      UserRole.VENDOR,
    ]);
  });

  it('leaves the admin reads on the class default', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, handlerOf('findAll')),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, handlerOf('findOne')),
    ).toBeUndefined();
  });

  it('updates the authenticated user, never a client-supplied id', async () => {
    await controller.updateMe({ phone: '0812345678' }, CURRENT_USER);

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { phone: '0812345678' },
    });
  });

  it('never returns blacklistReason', async () => {
    const result = await controller.updateMe(
      { phone: '0812345678' },
      CURRENT_USER,
    );

    expect(result).not.toHaveProperty('blacklistReason');
    expect(result).not.toHaveProperty('shops');
  });
});
