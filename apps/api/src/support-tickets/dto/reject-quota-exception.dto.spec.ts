import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RejectQuotaExceptionDto } from './reject-quota-exception.dto';

describe('RejectQuotaExceptionDto', () => {
  const pipe = new ValidationPipe({ transform: true });
  const metadata = {
    type: 'body' as const,
    metatype: RejectQuotaExceptionDto,
  };

  it('rejects a whitespace-only reason', async () => {
    await expect(
      pipe.transform({ reason: '   ' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trims the accepted reason before the service receives it', async () => {
    await expect(
      pipe.transform({ reason: '  โควตาของงานนี้เต็มแล้ว  ' }, metadata),
    ).resolves.toMatchObject({ reason: 'โควตาของงานนี้เต็มแล้ว' });
  });
});
