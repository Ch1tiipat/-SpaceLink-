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

  it.each([1006, 1007, 1008, 1011, 1013, 1014])(
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
    'maps provider/service code %s to ERROR',
    async (code) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(response({ code, message: 'service error' }, 400));

      const result = await verifier().verify(INPUT);

      expect(result.status).toBe(SlipStatus.ERROR);
    },
  );

  it('returns ERROR when SlipOK is unreachable and does not leak inputs', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await verifier().verify(INPUT);

    expect(result).toEqual({
      status: SlipStatus.ERROR,
      message: 'SlipOK service is unavailable',
    });
    expect(result.message).not.toContain(INPUT.slipImageUrl);
    expect(result.message).not.toContain('api-key-secret');
  });
});
