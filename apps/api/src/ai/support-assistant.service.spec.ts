import { ConfigService } from '@nestjs/config';
import { SupportAssistantService } from './support-assistant.service';

describe('SupportAssistantService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function service(env: Record<string, string>) {
    return new SupportAssistantService(
      new ConfigService({
        SUPPORT_ASSISTANT: 'gemini',
        GEMINI_API_KEY: 'gemini-secret',
        GEMINI_SUPPORT_MODEL: 'gemini-3.6-flash',
        ...env,
      }),
    );
  }

  it('uses Gemini 3.6 Flash without putting the API key in the URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [
          { content: { parts: [{ text: 'เปิดหน้า Event แล้วเลือกบูธครับ' }] } },
        ],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(service({}).ask('เริ่มจองอย่างไร')).resolves.toEqual({
      answer: 'เปิดหน้า Event แล้วเลือกบูธครับ',
      source: 'AI_GEMINI',
    });

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toContain('/gemini-3.6-flash:generateContent');
    expect(url).not.toContain('gemini-secret');
    expect(options.headers['x-goog-api-key']).toBe('gemini-secret');
    expect(options.body).toContain('เริ่มจองอย่างไร');
    expect(options.body).not.toContain('gemini-secret');
  });

  it('falls back when Gemini returns an error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429 }) as typeof fetch;

    const result = await service({}).ask('อัปโหลดสลิปอย่างไร');

    expect(result.source).toBe('RULE_BASED');
    expect(result.answer).toContain('อัปโหลดหลักฐานการชำระเงิน');
  });

  it('uses the fallback without calling Gemini when rule mode is selected', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await service({ SUPPORT_ASSISTANT: 'rule' }).ask(
      'เข้าสู่ระบบอย่างไร',
    );

    expect(result.source).toBe('RULE_BASED');
    expect(result.answer).toContain('Email OTP');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
