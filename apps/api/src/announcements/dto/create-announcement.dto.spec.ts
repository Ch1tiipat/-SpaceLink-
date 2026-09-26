import { AnnouncementType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAnnouncementDto } from './create-announcement.dto';
import { UpdateAnnouncementDto } from './update-announcement.dto';

describe('announcement DTOs', () => {
  const requiredFields = {
    title: 'แจ้งเปลี่ยนเวลาเปิดงาน',
    body: 'งานจะเปิดเวลา 10.00 น.',
  };

  it.each([AnnouncementType.EVENT, AnnouncementType.ANNOUNCEMENT])(
    'accepts announcement type %s',
    async (type) => {
      const input = plainToInstance(CreateAnnouncementDto, {
        ...requiredFields,
        type,
      });

      await expect(validate(input)).resolves.toHaveLength(0);
    },
  );

  it('accepts an optional event UUID and a null update to unlink it', async () => {
    const createInput = plainToInstance(CreateAnnouncementDto, {
      ...requiredFields,
      eventId: '00000000-0000-4000-8000-000000000003',
    });
    const updateInput = plainToInstance(UpdateAnnouncementDto, {
      eventId: null,
    });

    await expect(validate(createInput)).resolves.toHaveLength(0);
    await expect(validate(updateInput)).resolves.toHaveLength(0);
  });

  it.each([{ type: 'NEWS' }, { eventId: 'not-a-uuid' }])(
    'rejects invalid schema fields: %j',
    async (fields) => {
      const input = plainToInstance(CreateAnnouncementDto, {
        ...requiredFields,
        ...fields,
      });

      await expect(validate(input)).resolves.not.toHaveLength(0);
    },
  );
});
