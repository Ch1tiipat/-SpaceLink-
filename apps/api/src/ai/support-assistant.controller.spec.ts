import { Test } from '@nestjs/testing';
import { SupportAssistantController } from './support-assistant.controller';
import { SupportAssistantService } from './support-assistant.service';

describe('SupportAssistantController', () => {
  const ask = jest.fn();
  let controller: SupportAssistantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [SupportAssistantController],
      providers: [
        {
          provide: SupportAssistantService,
          useValue: { ask },
        },
      ],
    }).compile();

    controller = moduleRef.get(SupportAssistantController);
  });

  it('passes the validated question to the assistant service', async () => {
    ask.mockResolvedValue({ answer: 'คำตอบ', source: 'AI_GEMINI' });

    await expect(
      controller.ask({ question: 'จองบูธอย่างไร' }),
    ).resolves.toEqual({
      answer: 'คำตอบ',
      source: 'AI_GEMINI',
    });
    expect(ask).toHaveBeenCalledWith('จองบูธอย่างไร');
  });
});
