import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const mockPrismaService = {};

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('is read-only and restricted to super admins', () => {
    expect(Reflect.getMetadata(ROLES_KEY, BookingsController)).toEqual([
      UserRole.SUPER_ADMIN,
    ]);
    expect(BookingsController.prototype).not.toHaveProperty('create');
    expect(BookingsController.prototype).not.toHaveProperty('update');
    expect(BookingsController.prototype).not.toHaveProperty('remove');
  });
});
