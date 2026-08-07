import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

const CATEGORIES = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'งานฝีมือ' },
];

const findAll = jest.fn();
const mockCategoriesService = { findAll };

function handlerOf(name: 'findAll'): object {
  const descriptor = Object.getOwnPropertyDescriptor(
    CategoriesController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`Missing controller handler: ${name}`);
  }
  return descriptor.value as object;
}

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /*
   * Product categories are public reference data, so this route is unguarded
   * on purpose — the same call EventsController makes. Asserted rather than
   * assumed: adding a guard here would silently break the shop form for a
   * vendor who has not signed in yet, and removing one elsewhere is the kind
   * of change that needs to be deliberate. Both directions fail this test.
   */
  it('carries no guard metadata on the class or the handler', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, CategoriesController),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, handlerOf('findAll')),
    ).toBeUndefined();
  });

  it('declares no role restriction', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, CategoriesController),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, handlerOf('findAll')),
    ).toBeUndefined();
  });

  /*
   * Read-only by design: this module exists to feed the category picker. A
   * write route appearing here belongs to a different ticket (§2.3).
   */
  it('exposes no write handlers', () => {
    expect(CategoriesController.prototype).not.toHaveProperty('create');
    expect(CategoriesController.prototype).not.toHaveProperty('update');
    expect(CategoriesController.prototype).not.toHaveProperty('remove');
  });

  it('delegates to the service', async () => {
    findAll.mockResolvedValue(CATEGORIES);

    await expect(controller.findAll()).resolves.toEqual(CATEGORIES);
    expect(findAll).toHaveBeenCalledWith();
  });
});
