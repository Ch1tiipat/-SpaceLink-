import { BadRequestException } from '@nestjs/common';
import { isLooseUuid } from '../utils/uuid.util';
import { LooseUuidPipe } from './loose-uuid.pipe';

const LEGACY_UUID = '11111111-1111-1111-1111-111111111111';
const RFC_UUID = '11111111-1111-4111-8111-111111111111';

describe('isLooseUuid', () => {
  it.each([LEGACY_UUID, RFC_UUID])('accepts UUID-shaped value %s', (value) => {
    expect(isLooseUuid(value)).toBe(true);
  });

  it.each(['not-a-uuid', "' OR 1=1", '', null, undefined])(
    'rejects malformed value %p',
    (value) => {
      expect(isLooseUuid(value)).toBe(false);
    },
  );
});

describe('LooseUuidPipe', () => {
  const pipe = new LooseUuidPipe();

  it.each([LEGACY_UUID, RFC_UUID])('accepts UUID-shaped value %s', (value) => {
    expect(pipe.transform(value)).toBe(value);
  });

  it.each(['not-a-uuid', "' OR 1=1", ''])(
    'rejects malformed value %p with the ParseUUIDPipe response',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(
        new BadRequestException('Validation failed (uuid is expected)'),
      );
    },
  );
});
