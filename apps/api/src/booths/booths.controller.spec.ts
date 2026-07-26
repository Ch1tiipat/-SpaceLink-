import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BoothsController } from './booths.controller';
import { BoothsService } from './booths.service';

const mockPrismaService = {};

describe('BoothsController', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoothsController],
      providers: [
        BoothsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<BoothsController>(BoothsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
