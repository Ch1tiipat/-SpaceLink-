import { Prisma, SlipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SlipVerificationService } from './slip-verification.service';
import type { SlipVerificationRequest } from './slip-verification.service';
import type {
  SlipVerificationResult,
  SlipVerifier,
} from './slip-verifier.interface';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const SLIP_URL =
  'https://example.invalid/signed/slip.jpg?token=short-lived-secret';
const SLIP_OBJECT_PATH = 'vendor-id/booking-id/stored-slip.jpg';

const REQUEST: SlipVerificationRequest = {
  bookingId: BOOKING_ID,
  slipImageUrl: SLIP_URL,
  storedObjectPath: SLIP_OBJECT_PATH,
  expectedAmount: new Prisma.Decimal('1500.00'),
};

const VERIFIED: SlipVerificationResult = {
  status: SlipStatus.VERIFIED,
  transRef: 'MOCK-0123456789ABCDEF',
  amount: new Prisma.Decimal('1500.00'),
  sendingBank: '014',
  senderName: 'สมชาย ใจดี',
  receiverName: 'บริษัท สเปซลิงก์ จำกัด',
  raw: { success: true, data: { transRef: 'MOCK-0123456789ABCDEF' } },
  message: 'ok',
};

const ERRORED: SlipVerificationResult = {
  status: SlipStatus.ERROR,
  message: 'ตรวจสอบสลิปอัตโนมัติไม่พร้อมใช้งาน',
};

/** The `verified_slip` row the service is expected to build. */
type SlipRow = Prisma.VerifiedSlipUncheckedCreateInput;

function createdRow(create: jest.Mock): SlipRow {
  const [args] = create.mock.calls[0] as [{ data: SlipRow }];

  return args.data;
}

describe('SlipVerificationService', () => {
  let prisma: { verifiedSlip: { create: jest.Mock } };
  let verifier: { verify: jest.Mock };

  function createService(
    provider: SlipVerifier = verifier,
  ): SlipVerificationService {
    return new SlipVerificationService(
      provider,
      prisma as unknown as PrismaService,
    );
  }

  beforeEach(() => {
    prisma = { verifiedSlip: { create: jest.fn().mockResolvedValue({}) } };
    verifier = { verify: jest.fn().mockResolvedValue(VERIFIED) };
  });

  it('passes only the verifier contract down to the provider', async () => {
    await createService().verify(REQUEST);

    // `bookingId` is ours, not the provider's — a verifier has no business
    // knowing which booking a slip belongs to.
    expect(verifier.verify).toHaveBeenCalledWith({
      slipImageUrl: SLIP_URL,
      expectedAmount: REQUEST.expectedAmount,
    });
  });

  it('writes exactly one row carrying the provider fields', async () => {
    const result = await createService().verify(REQUEST);

    expect(result).toBe(VERIFIED);
    expect(prisma.verifiedSlip.create).toHaveBeenCalledTimes(1);

    const row = createdRow(prisma.verifiedSlip.create);
    expect(row.bookingId).toBe(BOOKING_ID);
    expect(row.slipImageUrl).toBe(SLIP_OBJECT_PATH);
    expect(row.slipImageUrl).not.toContain('token=');
    expect(row.slipokStatus).toBe(SlipStatus.VERIFIED);
    expect(row.transRef).toBe(VERIFIED.transRef);
    expect(row.sendingBank).toBe(VERIFIED.sendingBank);
    expect(row.senderName).toBe(VERIFIED.senderName);
    expect(row.receiverName).toBe(VERIFIED.receiverName);
    // The provider's untouched body, persisted as `slipok_raw`. It is what an
    // ORG_ADMIN has to look at when a vendor disputes an outcome.
    expect(row.slipokRaw).toEqual(VERIFIED.raw);
    expect(row.verifiedAt).toBeInstanceOf(Date);
  });

  it('stores the amount the provider read, unchanged', async () => {
    await createService().verify(REQUEST);

    const amount = createdRow(prisma.verifiedSlip.create).amount;

    // `.equals()`, not `===`: §6.3.7 compares this column to
    // `booking.boothPrice` numerically, and two equal Decimals are still two
    // objects.
    expect(amount).toBeInstanceOf(Prisma.Decimal);
    expect((amount as Prisma.Decimal).equals(new Prisma.Decimal('1500'))).toBe(
      true,
    );
  });

  // A verification that left no row behind is a verification nobody can review.
  // An ORG_ADMIN deciding whether to take the payment-exempt path (§8 step 6)
  // needs to see that the check ran and failed, not an empty table.
  it('still writes a row when the provider reports ERROR', async () => {
    verifier.verify.mockResolvedValue(ERRORED);

    const result = await createService().verify(REQUEST);

    expect(result).toBe(ERRORED);
    expect(prisma.verifiedSlip.create).toHaveBeenCalledTimes(1);

    const row = createdRow(prisma.verifiedSlip.create);
    expect(row.slipokStatus).toBe(SlipStatus.ERROR);
    expect(row.transRef).toBeUndefined();
    expect(row.slipokRaw).toBeUndefined();
    // Nothing was verified, so the timestamp stays null rather than recording
    // the moment the check gave up.
    expect(row.verifiedAt).toBeNull();
  });

  it('records zero rather than the expected amount when none was read', async () => {
    verifier.verify.mockResolvedValue(ERRORED);

    await createService().verify(REQUEST);

    const amount = createdRow(prisma.verifiedSlip.create).amount;

    // The column is NOT NULL, so something must go in. Filling it with
    // `expectedAmount` would make a slip that was never read satisfy the
    // equality check in §6.3.7 — the one comparison that decides whether a
    // vendor paid the right amount.
    expect((amount as Prisma.Decimal).equals(new Prisma.Decimal(0))).toBe(true);
  });

  // The scope boundary on the class, asserted rather than only commented: this
  // service verifies and records. Confirming the booking is §8 step 3 and
  // belongs to the booking service.
  it('does not touch the booking', async () => {
    const booking = { update: jest.fn(), findUnique: jest.fn() };
    const service = new SlipVerificationService(verifier, {
      ...prisma,
      booking,
    } as unknown as PrismaService);

    await service.verify(REQUEST);

    expect(booking.findUnique).not.toHaveBeenCalled();
    expect(booking.update).not.toHaveBeenCalled();
  });

  it('propagates a provider failure without writing a row', async () => {
    verifier.verify.mockRejectedValue(new Error('SlipOK unreachable'));

    // A provider that threw produced no result to record. A verifier is meant
    // to answer ERROR rather than throw (see ManualSlipVerifier), so an
    // exception here is a defect in the provider and must not be swallowed
    // into a row that claims something happened.
    await expect(createService().verify(REQUEST)).rejects.toThrow(
      'SlipOK unreachable',
    );
    expect(prisma.verifiedSlip.create).not.toHaveBeenCalled();
  });
});
