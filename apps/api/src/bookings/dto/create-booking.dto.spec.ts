import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

const LEGACY_EVENT_ID = '44444444-4444-4444-4444-444444444444';
const LEGACY_BOOTH_ID = '33333333-3333-3333-3333-333333333333';
const LEGACY_SHOP_ID = '66666666-6666-6666-6666-666666666666';

function constraintsFor(body: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(CreateBookingDto, body)).flatMap(
    (error) => Object.keys(error.constraints ?? {}),
  );
}

describe('CreateBookingDto', () => {
  it('accepts legacy UUID-shaped booking ids', () => {
    expect(
      constraintsFor({
        eventId: LEGACY_EVENT_ID,
        boothId: LEGACY_BOOTH_ID,
        shopId: LEGACY_SHOP_ID,
      }),
    ).toEqual([]);
  });

  it.each(['not-a-uuid', "' OR 1=1", ''])(
    'rejects malformed id %p',
    (value) => {
      expect(
        constraintsFor({
          eventId: value,
          boothId: value,
          shopId: value,
        }),
      ).toEqual(expect.arrayContaining(['matches']));
    },
  );
});
