import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';

const mockPrismaService = {};

describe('VenuesController', () => {
  let controller: VenuesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenuesController],
      providers: [
        VenuesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<VenuesController>(VenuesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
