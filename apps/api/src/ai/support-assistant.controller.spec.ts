import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { AskSupportAssistantDto } from './dto/ask-support-assistant.dto';
import { SupportAssistantController } from './support-assistant.controller';
import { SupportAssistantService } from './support-assistant.service';

jest.mock('../auth/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

const USER_ID = '00000000-0000-4000-8000-000000000001';
const user = {
  id: USER_ID,
  authUserId: '00000000-0000-4000-8000-000000000002',
  email: 'vendor@example.com',
  fullName: 'Vendor Demo',
  phone: null,
  role: UserRole.VENDOR,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
} satisfies User;

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

  it('requires Supabase authentication', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SupportAssistantController),
    ).toEqual([SupabaseAuthGuard]);
  });

  it('uses the authenticated user id and forwards the bounded conversation', async () => {
    ask.mockResolvedValue({
      answer: 'คำตอบ',
      source: 'AI_GEMINI',
      actions: [],
    });
    const history = [
      { role: 'user' as const, text: 'มีงานอะไรบ้าง' },
      { role: 'assistant' as const, text: 'มีงานเกษตรครับ' },
    ];

    await expect(
      controller.ask(user, { question: 'จัดที่ไหน', history }),
    ).resolves.toEqual({
      answer: 'คำตอบ',
      source: 'AI_GEMINI',
      actions: [],
    });
    expect(ask).toHaveBeenCalledWith({
      userId: USER_ID,
      question: 'จัดที่ไหน',
      history,
    });
  });

  it('rejects more than ten history messages before the controller runs', async () => {
    const input = plainToInstance(AskSupportAssistantDto, {
      question: 'คำถามล่าสุด',
      history: Array.from({ length: 11 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        text: `ข้อความ ${index + 1}`,
      })),
    });

    const errors = await validate(input);

    expect(errors.some((error) => error.property === 'history')).toBe(true);
  });
});
