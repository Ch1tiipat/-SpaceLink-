import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

const mockPrismaService = {};

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('keeps public reads unguarded and exposes no mutation handlers', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, OrganizationsController),
    ).toBeUndefined();
    expect(OrganizationsController.prototype).not.toHaveProperty('create');
    expect(OrganizationsController.prototype).not.toHaveProperty('update');
    expect(OrganizationsController.prototype).not.toHaveProperty('remove');
  });
});
