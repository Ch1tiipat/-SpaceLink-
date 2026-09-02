import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

const findMapBySlug = jest.fn();
const mockEventsService = { findMapBySlug };

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: mockEventsService }],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates a public slug map lookup to the service', async () => {
    findMapBySlug.mockResolvedValue({ event: { id: 'event-1' }, zones: [] });

    await expect(
      controller.findMapBySlug('future-tech-abc123'),
    ).resolves.toEqual({ event: { id: 'event-1' }, zones: [] });
    expect(findMapBySlug).toHaveBeenCalledWith('future-tech-abc123');
  });
});
