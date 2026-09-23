import { hasEventEndInstantPassed } from './event-time';

const EVENT_DATE = new Date('2026-09-22T00:00:00.000Z');

describe('hasEventEndInstantPassed', () => {
  it('changes from false to true at the Bangkok event end minute', () => {
    expect(
      hasEventEndInstantPassed(
        EVENT_DATE,
        '10:00',
        new Date('2026-09-22T02:59:59.999Z'),
      ),
    ).toBe(false);
    expect(
      hasEventEndInstantPassed(
        EVENT_DATE,
        '10:00',
        new Date('2026-09-22T03:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('defaults a missing end time to 23:59 Bangkok time', () => {
    expect(
      hasEventEndInstantPassed(
        EVENT_DATE,
        null,
        new Date('2026-09-22T16:58:59.999Z'),
      ),
    ).toBe(false);
    expect(
      hasEventEndInstantPassed(
        EVENT_DATE,
        null,
        new Date('2026-09-22T16:59:00.000Z'),
      ),
    ).toBe(true);
  });
});
