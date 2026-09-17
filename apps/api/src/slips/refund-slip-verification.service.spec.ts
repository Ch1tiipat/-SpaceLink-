import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, SlipStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  RefundSlipVerificationService,
  refundPayoutNamesMatch,
} from './refund-slip-verification.service';

const REFUND_ID = '11111111-1111-4111-8111-111111111111';
const EXPECTED = new Prisma.Decimal('100.00');

describe('RefundSlipVerificationService', () => {
  const verify = jest.fn();
  const findUnique = jest.fn();
  const findDuplicateRefund = jest.fn();
  const updateMany = jest.fn();
  const transaction = {
    verifiedSlip: { findUnique },
    refundRequest: { updateMany },
    $queryRaw: findDuplicateRefund,
  };
  const prisma = {
    $transaction: jest.fn(
      (work: (client: typeof transaction) => Promise<unknown>) =>
        work(transaction),
    ),
  };
  const service = new RefundSlipVerificationService(
    { verify },
    prisma as unknown as PrismaService,
  );

  const request = {
    refundId: REFUND_ID,
    expectedAmount: EXPECTED,
    payoutAccountName: 'นาย สมชาย ใจดี',
    objectPath: `refund-payouts/${REFUND_ID}/slip.png`,
    slipImageUrl: 'https://storage.example/signed',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue(null);
    findDuplicateRefund.mockResolvedValue([]);
    updateMany.mockResolvedValue({ count: 1 });
    verify.mockResolvedValue({
      status: SlipStatus.VERIFIED,
      amount: EXPECTED,
      transRef: 'refund-trans-ref',
      receiverName: 'สมชาย ใจดี',
    });
  });

  it('stores verified refund evidence without creating a VerifiedSlip', async () => {
    await expect(service.verifyAndStore(request)).resolves.toEqual({
      status: 'VERIFIED',
      amount: '100',
      receiverName: 'สมชาย ใจดี',
      verifiedAt: expect.any(String) as string,
      nameMismatchWarning: false,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { transRef: 'refund-trans-ref' },
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: REFUND_ID,
        status: 'APPROVED',
        evidenceUrls: { equals: Prisma.DbNull },
      },
      data: {
        evidenceUrls: expect.objectContaining({
          kind: 'REFUND_PAYOUT_SLIP',
          transRef: 'refund-trans-ref',
          objectPath: request.objectPath,
          amount: '100',
        }) as object,
      },
    });
  });

  it('rejects an unverified or wrong-amount slip without storing evidence', async () => {
    verify.mockResolvedValueOnce({ status: SlipStatus.INVALID });
    await expect(service.verifyAndStore(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    verify.mockResolvedValueOnce({
      status: SlipStatus.VERIFIED,
      amount: new Prisma.Decimal('99'),
      transRef: 'wrong-amount',
    });
    await expect(service.verifyAndStore(request)).rejects.toThrow(
      'ยอดในสลิปไม่ตรงกับยอดคืนเงินที่อนุมัติ',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects provider, payment-slip and refund-evidence duplicates', async () => {
    verify.mockResolvedValueOnce({ status: SlipStatus.DUPLICATE });
    await expect(service.verifyAndStore(request)).rejects.toThrow(
      'สลิปนี้เคยถูกใช้แล้ว',
    );

    findUnique.mockResolvedValueOnce({ id: 'payment-slip' });
    await expect(service.verifyAndStore(request)).rejects.toBeInstanceOf(
      ConflictException,
    );

    findDuplicateRefund.mockResolvedValueOnce([{ id: 'another-refund' }]);
    await expect(service.verifyAndStore(request)).rejects.toThrow(
      'สลิปนี้เคยถูกใช้แล้ว',
    );
  });

  it('returns a non-blocking warning when normalized recipient names differ', async () => {
    verify.mockResolvedValueOnce({
      status: SlipStatus.VERIFIED,
      amount: EXPECTED,
      transRef: 'different-name',
      receiverName: 'นางสาว คนละชื่อ',
    });

    await expect(service.verifyAndStore(request)).resolves.toEqual(
      expect.objectContaining({ nameMismatchWarning: true }),
    );
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('refundPayoutNamesMatch', () => {
  it('normalizes titles, whitespace and English case', () => {
    expect(refundPayoutNamesMatch('นายสมชาย   ใจดี', 'สมชาย ใจดี')).toBe(true);
    expect(refundPayoutNamesMatch('MR. JOHN DOE', 'John Doe')).toBe(true);
    expect(refundPayoutNamesMatch('สมหญิง ใจดี', 'สมชาย ใจดี')).toBe(false);
  });
});
