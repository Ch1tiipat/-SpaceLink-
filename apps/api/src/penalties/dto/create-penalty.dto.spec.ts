import { PenaltyReason } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateAdminPenaltyDto } from './create-admin-penalty.dto';
import { CreatePenaltyDto } from './create-penalty.dto';

describe('penalty DTOs', () => {
  it.each([
    [PenaltyReason.NO_SHOW, undefined],
    [PenaltyReason.OTHER, 1],
    [PenaltyReason.CONTRACT_BREACH, 100],
  ])('accepts reason %s with points %p', async (reason, points) => {
    const dto = Object.assign(new CreatePenaltyDto(), { reason, points });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([0, 101, 1.5])('rejects invalid points %p', async (points) => {
    const dto = Object.assign(new CreatePenaltyDto(), {
      reason: PenaltyReason.OTHER,
      points,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('accepts legacy UUID-shaped identifiers for a direct penalty', async () => {
    const dto = Object.assign(new CreateAdminPenaltyDto(), {
      organizationId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      bookingId: '33333333-3333-3333-3333-333333333333',
      reason: PenaltyReason.NO_SHOW,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['not-a-uuid', `' OR 1=1`, ''])(
    'rejects invalid identifier %p',
    async (userId) => {
      const dto = Object.assign(new CreateAdminPenaltyDto(), {
        organizationId: '11111111-1111-1111-1111-111111111111',
        userId,
        reason: PenaltyReason.NO_SHOW,
      });

      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );
});
