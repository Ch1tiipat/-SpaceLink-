import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
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

  it('keeps public reads unguarded and exposes no mutation handlers', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, VenuesController),
    ).toBeUndefined();
    expect(VenuesController.prototype).not.toHaveProperty('create');
    expect(VenuesController.prototype).not.toHaveProperty('update');
    expect(VenuesController.prototype).not.toHaveProperty('remove');
  });
});
