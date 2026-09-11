import { EventInformationType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEventInformationDto } from './create-event-information.dto';
import { ReorderEventInformationDto } from './reorder-event-information.dto';
import { UpdateEventInformationDto } from './update-event-information.dto';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';

describe('event information DTOs', () => {
  it('accepts a non-empty title, description, and supported type', async () => {
    const input = plainToInstance(CreateEventInformationDto, {
      title: 'เวิร์กช็อปทำพวงกุญแจ',
      description: 'เปิดให้ร่วมกิจกรรมตลอดวัน',
      type: EventInformationType.ACTIVITY,
    });
    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects blank text, overlong text, and unsupported types', async () => {
    const blank = plainToInstance(CreateEventInformationDto, {
      title: '   ',
      description: '   ',
      type: 'UNKNOWN',
    });
    const overlong = plainToInstance(CreateEventInformationDto, {
      title: 'ข้อมูล',
      description: 'ก'.repeat(5001),
      type: EventInformationType.FACILITY,
    });
    expect(await validate(blank)).not.toHaveLength(0);
    expect(await validate(overlong)).not.toHaveLength(0);
  });

  it('allows a partial update', async () => {
    const input = plainToInstance(UpdateEventInformationDto, {
      type: EventInformationType.ATMOSPHERE,
    });
    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('requires a non-empty unique UUID list for reorder', async () => {
    const valid = plainToInstance(ReorderEventInformationDto, {
      ids: [ITEM_ID],
    });
    const empty = plainToInstance(ReorderEventInformationDto, { ids: [] });
    const duplicate = plainToInstance(ReorderEventInformationDto, {
      ids: [ITEM_ID, ITEM_ID],
    });
    const invalid = plainToInstance(ReorderEventInformationDto, {
      ids: ['not-a-uuid'],
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(await validate(empty)).not.toHaveLength(0);
    expect(await validate(duplicate)).not.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
