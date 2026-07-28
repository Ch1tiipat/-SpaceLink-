import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

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

  it('keeps public reads unguarded and exposes no mutation handlers', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ZonesController),
    ).toBeUndefined();
    expect(ZonesController.prototype).not.toHaveProperty('create');
    expect(ZonesController.prototype).not.toHaveProperty('update');
    expect(ZonesController.prototype).not.toHaveProperty('remove');
  });
});
