import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const mockPrismaService = {};

describe('ZonesController', () => {
  let controller: ZonesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZonesController],
      providers: [
        ZonesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<ZonesController>(ZonesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
