import { ConfigService } from '@nestjs/config';
import { Prisma, SlipStatus } from '@prisma/client';
import { SlipOkSlipVerifier } from './slipok-slip-verifier';

const INPUT = {
  slipImageUrl: 'https://storage.example.test/signed/slip.png?token=secret',
  expectedAmount: new Prisma.Decimal('1500.00'),
};

function verifier() {
  return new SlipOkSlipVerifier(
    new ConfigService({
      SLIPOK_BRANCH_ID: 'branch-123',
      SLIPOK_API_KEY: 'api-key-secret',
    }),
  );
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SlipOkSlipVerifier', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('maps a valid SlipOK response to VERIFIED with Decimal money', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      response({
        success: true,
        data: {
          success: true,
          message: '✅',
          transRef: 'TX-001',
          sendingBank: '004',
          amount: 1500,
          sender: { displayName: 'ผู้โอน ทดสอบ' },
          receiver: { displayName: 'ร้าน SpaceLink' },
        },
      }),
    );

    const result = await verifier().verify(INPUT);

    expect(result.status).toBe(SlipStatus.VERIFIED);
    expect(result.amount?.equals(new Prisma.Decimal('1500'))).toBe(true);
    expect(result.transRef).toBe('TX-001');

    const request = fetchSpy.mock.calls[0];
    expect(request[0]).toBe(
      'https://api.slipok.com/api/line/apikey/branch-123',
    );
    const options = request[1] as RequestInit;
    expect(options.headers).toMatchObject({
      'x-authorization': 'api-key-secret',
    });
    expect(JSON.parse(options.body as string)).toMatchObject({
      url: INPUT.slipImageUrl,
      amount: 1500,
      log: true,
    });
  });

  it('maps SlipOK code 1012 to DUPLICATE without reusing transRef', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      response(
        {
          code: 1012,
          message: 'สลิปซ้ำ',
          data: { transRef: 'TX-USED', amount: 1500 },
        },
        400,
      ),
    );

    const result = await verifier().verify(INPUT);

    expect(result.status).toBe(SlipStatus.DUPLICATE);
    expect(result.transRef).toBeUndefined();
  });

  it.each([1005, 1006, 1007, 1008, 1011, 1013, 1014])(
    'maps invalid slip code %s to INVALID',
    async (code) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(response({ code, message: 'invalid' }, 400));

      const result = await verifier().verify(INPUT);

      expect(result.status).toBe(SlipStatus.INVALID);
    },
  );

  it.each([1002, 1003, 1004, 1009, 1010])(
    'throws for provider/service code %s',
    async (code) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(response({ code, message: 'service error' }, 400));

      await expect(verifier().verify(INPUT)).rejects.toThrow(
        `SlipOK request failed with provider code ${code}`,
      );
    },
  );

  it('maps a successful response without transaction details to ERROR', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      response({
        success: true,
        data: { success: true, message: 'missing transaction details' },
      }),
    );

    const result = await verifier().verify(INPUT);

    expect(result).toMatchObject({
      status: SlipStatus.ERROR,
      message: 'SlipOK response is missing transaction details',
    });
  });

  it('sanitizes malformed JSON without leaking the key or signed URL', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{not-json', {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const work = verifier().verify(INPUT);

    await expect(work).rejects.toThrow('SlipOK returned invalid JSON');
    await expect(work).rejects.not.toThrow(INPUT.slipImageUrl);
    await expect(work).rejects.not.toThrow('api-key-secret');
  });

  it('rejects an array response as malformed', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response([]));

    await expect(verifier().verify(INPUT)).rejects.toThrow(
      'SlipOK returned a malformed response',
    );
  });

  it('throws when SlipOK is unreachable and does not leak inputs', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const work = verifier().verify(INPUT);

    await expect(work).rejects.toThrow('SlipOK service is unavailable');
    await expect(work).rejects.not.toThrow(INPUT.slipImageUrl);
    await expect(work).rejects.not.toThrow('api-key-secret');
  });

  it('aborts and throws when SlipOK times out', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const work = verifier().verify(INPUT);
    const rejection = expect(work).rejects.toThrow('SlipOK request timed out');
    await jest.advanceTimersByTimeAsync(8_000);

    await rejection;
  });
});
