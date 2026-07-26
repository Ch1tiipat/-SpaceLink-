import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BoothsService } from './booths.service';

const mockPrismaService = {};

describe('BoothsService', () => {
  let service: BoothsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoothsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BoothsService>(BoothsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
