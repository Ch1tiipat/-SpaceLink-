import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListTransactionsQueryDto } from './list-transactions-query.dto';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('ListTransactionsQueryDto', () => {
  it('applies safe pagination and view defaults', async () => {
    const dto = plainToInstance(ListTransactionsQueryDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ view: 'BOOKINGS', page: 1, pageSize: 25 });
  });

  it('accepts the approved filters and transforms pagination', async () => {
    const dto = plainToInstance(ListTransactionsQueryDto, {
      view: 'PAYMENTS',
      eventId: UUID,
      zoneId: UUID,
      vendorUserId: UUID,
      shopId: UUID,
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'VERIFIED',
      refundStatus: 'PROCESSED',
      from: '2026-09-01',
      to: '2026-09-30',
      q: '  BK-123  ',
      page: '2',
      pageSize: '50',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ q: 'BK-123', page: 2, pageSize: 50 });
  });

  it.each([
    { view: 'UNKNOWN' },
    { eventId: 'not-a-uuid' },
    { paymentStatus: 'PAID' },
    { refundStatus: 'REQUESTED' },
    { from: '01/09/2026' },
    { page: '0' },
    { pageSize: '101' },
  ])('rejects invalid query %#', async (query) => {
    const dto = plainToInstance(ListTransactionsQueryDto, query);
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
