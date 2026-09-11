import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEventJoinInformationDto } from './create-event-join-information.dto';
import { ReorderEventJoinInformationDto } from './reorder-event-join-information.dto';
import { UpdateEventJoinInformationDto } from './update-event-join-information.dto';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';

describe('event join information DTOs', () => {
  it('accepts non-empty title and content', async () => {
    const input = plainToInstance(CreateEventJoinInformationDto, {
      title: 'จุดลงทะเบียน',
      content: 'ลงทะเบียนบริเวณทางเข้าหลัก',
    });
    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects blank and overlong content', async () => {
    const blank = plainToInstance(CreateEventJoinInformationDto, {
      title: '   ',
      content: '   ',
    });
    const overlong = plainToInstance(CreateEventJoinInformationDto, {
      title: 'ข้อมูล',
      content: 'ก'.repeat(5001),
    });
    expect(await validate(blank)).not.toHaveLength(0);
    expect(await validate(overlong)).not.toHaveLength(0);
  });

  it('allows a partial update', async () => {
    const input = plainToInstance(UpdateEventJoinInformationDto, {
      title: 'เวลาเปิดประตู',
    });
    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('requires a non-empty unique UUID list for reorder', async () => {
    const valid = plainToInstance(ReorderEventJoinInformationDto, {
      ids: [ITEM_ID],
    });
    const empty = plainToInstance(ReorderEventJoinInformationDto, { ids: [] });
    const duplicate = plainToInstance(ReorderEventJoinInformationDto, {
      ids: [ITEM_ID, ITEM_ID],
    });
    const invalid = plainToInstance(ReorderEventJoinInformationDto, {
      ids: ['not-a-uuid'],
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(await validate(empty)).not.toHaveLength(0);
    expect(await validate(duplicate)).not.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
