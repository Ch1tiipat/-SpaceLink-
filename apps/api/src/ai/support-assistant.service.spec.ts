import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { SupportAssistantMessageDto } from './dto/ask-support-assistant.dto';
import { SupportAssistantService } from './support-assistant.service';

const USER_ID = '00000000-0000-4000-8000-000000000001';

describe('SupportAssistantService', () => {
  const originalFetch = global.fetch;
  const findShops = jest.fn();
  const findBookings = jest.fn();
  const findEvents = jest.fn();
  const findAnnouncements = jest.fn<Promise<unknown[]>, [unknown]>();
  const prisma = {
    shop: { findMany: findShops },
    booking: { findMany: findBookings },
    event: { findMany: findEvents },
    announcement: { findMany: findAnnouncements },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    findShops.mockResolvedValue([]);
    findBookings.mockResolvedValue([]);
    findEvents.mockResolvedValue([]);
    findAnnouncements.mockResolvedValue([]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function service(env: Record<string, string> = {}) {
    return new SupportAssistantService(
      new ConfigService({
        SUPPORT_ASSISTANT: 'gemini',
        GEMINI_API_KEY: 'gemini-secret',
        GEMINI_SUPPORT_MODEL: 'gemini-3.6-flash',
        ...env,
      }),
      prisma,
    );
  }

  function ask(question: string, history: SupportAssistantMessageDto[] = []) {
    return service().ask({ userId: USER_ID, question, history });
  }

  it('uses only the authenticated user id for shops and bookings', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'คำตอบ' }] } }],
      }),
    }) as typeof fetch;

    await ask('ข้อมูลของฉัน');

    expect(findShops).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: USER_ID } }),
    );
    expect(findBookings).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorUserId: USER_ID } }),
    );
  });

  it('uses Gemini Flash, sends at most ten history messages, and keeps secrets out of the body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [
          { content: { parts: [{ text: 'งานนี้จัดที่โคราชครับ' }] } },
        ],
      }),
    });
    global.fetch = fetchMock as typeof fetch;
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `ข้อความ ${index + 1}`,
    }));

    await expect(ask('แล้วจัดที่ไหน', history)).resolves.toEqual({
      answer: 'งานนี้จัดที่โคราชครับ',
      source: 'AI_GEMINI',
      actions: ['OPEN_EVENTS'],
    });

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    const body = JSON.parse(options.body) as {
      contents: { role: string; parts: { text: string }[] }[];
    };
    expect(url).toContain('/gemini-3.6-flash:generateContent');
    expect(url).not.toContain('gemini-secret');
    expect(options.headers['x-goog-api-key']).toBe('gemini-secret');
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[0].parts[0].text).toContain('ข้อความ 3');
    expect(body.contents[0].parts[0].text).not.toContain('ข้อความ 1"');
    expect(body.contents[0].parts[0].text).toContain('แล้วจัดที่ไหน');
    expect(options.body).not.toContain('gemini-secret');
  });

  it('includes only published event context and announcements from those organizations', async () => {
    findEvents.mockResolvedValue([
      {
        organizationId: '00000000-0000-4000-8000-000000000010',
        name: 'งานเกษตร',
        description: null,
        startDate: new Date('2026-09-10T00:00:00.000Z'),
        endDate: new Date('2026-09-12T00:00:00.000Z'),
        startTime: '09:00',
        endTime: '18:00',
        contactPhone: null,
        contactEmail: null,
        policy: null,
        venue: { name: 'ศูนย์ประชุม', address: null, zones: [] },
      },
    ]);
    let capturedAnnouncementQuery: unknown;
    findAnnouncements.mockImplementation((query) => {
      capturedAnnouncementQuery = query;
      return Promise.resolve([
        {
          title: 'แจ้งเวลาเข้างาน',
          body: 'เข้าพื้นที่ได้ 06:00 น.',
          publishedAt: new Date('2026-08-28T00:00:00.000Z'),
          organization: { name: 'ผู้จัดงาน' },
        },
      ]);
    });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'คำตอบ' }] } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await ask('งานเกษตรมีประกาศอะไร');

    expect(findEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['PUBLISHED', 'ONGOING'] } },
      }),
    );
    expect(findAnnouncements).toHaveBeenCalled();
    const announcementQuery = capturedAnnouncementQuery as {
      where: { organizationId: { in: string[] }; isActive: boolean };
    };
    expect(announcementQuery.where.organizationId.in).toEqual([
      '00000000-0000-4000-8000-000000000010',
    ]);
    expect(announcementQuery.where.isActive).toBe(true);
    const body = (fetchMock.mock.calls[0] as [string, { body: string }])[1]
      .body;
    expect(body).toContain('แจ้งเวลาเข้างาน');
    expect(body).not.toContain('vendor@example.com');
  });

  it('falls back with the signed-in user own booking status when Gemini fails', async () => {
    findBookings.mockResolvedValue([
      {
        status: 'CONFIRMED',
        holdExpiresAt: null,
        event: { name: 'งานเกษตร' },
        booth: { code: 'A01', zone: { code: 'A', name: 'อาหาร' } },
        shop: { name: 'ร้านตัวอย่าง' },
      },
    ]);
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429 }) as typeof fetch;

    const result = await ask('สถานะการจองของฉัน');

    expect(result.source).toBe('RULE_BASED');
    expect(result.answer).toContain('งานเกษตร');
    expect(result.answer).toContain('ยืนยันแล้ว');
    expect(result.actions).toEqual(['OPEN_BOOKINGS']);
  });

  it('uses the fallback without calling Gemini when rule mode is selected', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await service({ SUPPORT_ASSISTANT: 'rule' }).ask({
      userId: USER_ID,
      question: 'เข้าสู่ระบบอย่างไร',
      history: [],
    });

    expect(result.source).toBe('RULE_BASED');
    expect(result.answer).toContain('Email OTP');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
