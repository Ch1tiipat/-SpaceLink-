import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEventDto } from './update-event.dto';

describe('UpdateEventDto', () => {
  it('accepts an ordered list of unique HTTPS gallery URLs', async () => {
    const input = plainToInstance(UpdateEventDto, {
      galleryUrls: [
        'https://project.supabase.co/storage/v1/object/public/event-gallery/event/one',
        'https://project.supabase.co/storage/v1/object/public/event-gallery/event/two',
      ],
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('accepts an empty gallery for removing every image', async () => {
    const input = plainToInstance(UpdateEventDto, { galleryUrls: [] });
    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it.each([
    ['non-array value', 'https://example.com/image.png'],
    ['non-HTTPS URL', ['http://example.com/image.png']],
    ['invalid URL', ['not-a-url']],
    ['duplicate URL', ['https://example.com/a', 'https://example.com/a']],
    [
      'more than ten URLs',
      Array.from({ length: 11 }, (_, index) => `https://example.com/${index}`),
    ],
  ])('rejects %s', async (_label, galleryUrls) => {
    const input = plainToInstance(UpdateEventDto, { galleryUrls });
    await expect(validate(input)).resolves.not.toHaveLength(0);
  });
});
