import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const mockPrismaService = {};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
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

  it('is read-only and restricted to super admins', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
    expect(UsersController.prototype).not.toHaveProperty('create');
    expect(UsersController.prototype).not.toHaveProperty('update');
    expect(UsersController.prototype).not.toHaveProperty('remove');
  });
});
