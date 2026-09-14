import { ValidationPipe } from '@nestjs/common';
import { UpdateNotificationPreferencesDto } from './update-notification-preferences.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

async function transform(
  body: unknown,
): Promise<UpdateNotificationPreferencesDto> {
  return (await pipe.transform(body, {
    type: 'body',
    metatype: UpdateNotificationPreferencesDto,
  })) as UpdateNotificationPreferencesDto;
}

describe('UpdateNotificationPreferencesDto', () => {
  it('accepts an empty partial update and boolean values', async () => {
    await expect(transform({})).resolves.toEqual({});
    await expect(
      transform({ BOOKING_STATUS: false, SYSTEM: true }),
    ).resolves.toEqual({ BOOKING_STATUS: false, SYSTEM: true });
  });

  it.each([{ PAYMENT: null }, { PENALTY: 'false' }, { REFUND: 0 }])(
    'rejects non-boolean values: %p',
    async (body) => {
      await expect(transform(body)).rejects.toThrow();
    },
  );

  it('rejects unsupported preference keys', async () => {
    await expect(transform({ EMAIL: false })).rejects.toThrow();
  });
});
