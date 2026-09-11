import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventInformationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventInformationService } from './event-information.service';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const FIRST_ID = '33333333-3333-4333-8333-333333333333';
const SECOND_ID = '44444444-4444-4444-8444-444444444444';

const eventFindFirst = jest.fn();
const informationFindFirst = jest.fn();
const informationFindMany = jest.fn();
const informationCreate = jest.fn();
const informationUpdate = jest.fn();
const informationDelete = jest.fn();
const informationUpdateMany = jest.fn();
const transaction = jest.fn();

const prisma = {
  event: { findFirst: eventFindFirst },
  eventInformation: {
    findFirst: informationFindFirst,
    findMany: informationFindMany,
    create: informationCreate,
    update: informationUpdate,
    delete: informationDelete,
    updateMany: informationUpdateMany,
  },
  $transaction: transaction,
};

describe('EventInformationService', () => {
  let service: EventInformationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    transaction.mockImplementation((input: unknown) =>
      Array.isArray(input)
        ? Promise.all(input)
        : (input as (client: typeof prisma) => unknown)(prisma),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventInformationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EventInformationService);
  });

  it('appends a new item after the current highest sort order', async () => {
    eventFindFirst.mockResolvedValue({ id: EVENT_ID });
    informationFindFirst.mockResolvedValue({ sortOrder: 2 });
    informationCreate.mockResolvedValue({ id: FIRST_ID, sortOrder: 3 });

    await service.create(EVENT_ID, ORGANIZATION_ID, {
      title: 'จุดถ่ายภาพ',
      description: 'อยู่หน้าเวทีหลัก',
      type: EventInformationType.ATMOSPHERE,
    });

    expect(eventFindFirst).toHaveBeenCalledWith({
      where: { id: EVENT_ID, organizationId: ORGANIZATION_ID },
      select: { id: true },
    });
    expect(informationCreate).toHaveBeenCalledWith({
      data: {
        eventId: EVENT_ID,
        title: 'จุดถ่ายภาพ',
        description: 'อยู่หน้าเวทีหลัก',
        type: EventInformationType.ATMOSPHERE,
        sortOrder: 3,
      },
    });
  });

  it('answers 404 before writing when the event is outside the organization', async () => {
    eventFindFirst.mockResolvedValue(null);
    await expect(
      service.create(EVENT_ID, ORGANIZATION_ID, {
        title: 'กิจกรรม',
        description: 'รายละเอียด',
        type: EventInformationType.ACTIVITY,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(informationCreate).not.toHaveBeenCalled();
  });

  it('updates only an item belonging to the scoped event', async () => {
    informationFindFirst.mockResolvedValue({ id: FIRST_ID, sortOrder: 0 });
    informationUpdate.mockResolvedValue({ id: FIRST_ID, title: 'หัวข้อใหม่' });
    await service.update(EVENT_ID, FIRST_ID, ORGANIZATION_ID, {
      title: 'หัวข้อใหม่',
    });
    expect(informationFindFirst).toHaveBeenCalledWith({
      where: {
        id: FIRST_ID,
        eventId: EVENT_ID,
        event: { organizationId: ORGANIZATION_ID },
      },
      select: { id: true, sortOrder: true },
    });
    expect(informationUpdate).toHaveBeenCalledWith({
      where: { id: FIRST_ID },
      data: { title: 'หัวข้อใหม่' },
    });
  });

  it('answers 404 for an item from another event or organization', async () => {
    informationFindFirst.mockResolvedValue(null);
    await expect(
      service.update(EVENT_ID, FIRST_ID, ORGANIZATION_ID, { title: 'ใหม่' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(informationUpdate).not.toHaveBeenCalled();
  });

  it('deletes and closes the sort-order gap atomically', async () => {
    informationFindFirst.mockResolvedValue({ id: FIRST_ID, sortOrder: 1 });
    informationDelete.mockResolvedValue({ id: FIRST_ID, sortOrder: 1 });
    informationUpdateMany.mockResolvedValue({ count: 1 });
    await service.remove(EVENT_ID, FIRST_ID, ORGANIZATION_ID);
    expect(informationDelete).toHaveBeenCalledWith({ where: { id: FIRST_ID } });
    expect(informationUpdateMany).toHaveBeenCalledWith({
      where: { eventId: EVENT_ID, sortOrder: { gt: 1 } },
      data: { sortOrder: { decrement: 1 } },
    });
  });

  it('rejects reorder unless the request is the exact event item set', async () => {
    eventFindFirst.mockResolvedValue({ id: EVENT_ID });
    informationFindMany.mockResolvedValue([
      { id: FIRST_ID },
      { id: SECOND_ID },
    ]);
    await expect(
      service.reorder(EVENT_ID, ORGANIZATION_ID, [FIRST_ID]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('reorders the exact event item set atomically', async () => {
    eventFindFirst.mockResolvedValue({ id: EVENT_ID });
    informationFindMany
      .mockResolvedValueOnce([{ id: FIRST_ID }, { id: SECOND_ID }])
      .mockResolvedValueOnce([
        { id: SECOND_ID, sortOrder: 0 },
        { id: FIRST_ID, sortOrder: 1 },
      ]);
    informationUpdate.mockResolvedValue({});

    await expect(
      service.reorder(EVENT_ID, ORGANIZATION_ID, [SECOND_ID, FIRST_ID]),
    ).resolves.toEqual([
      { id: SECOND_ID, sortOrder: 0 },
      { id: FIRST_ID, sortOrder: 1 },
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(informationUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: SECOND_ID },
      data: { sortOrder: 0 },
    });
  });
});
