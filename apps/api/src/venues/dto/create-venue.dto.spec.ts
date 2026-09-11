import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVenueDto } from './create-venue.dto';
import { UpdateVenueDto } from './update-venue.dto';

describe('venue DTOs', () => {
  it('accepts an optional HTTPS Google Maps URL', async () => {
    const input = plainToInstance(CreateVenueDto, {
      name: 'ตลาดทดสอบ',
      googleMapsUrl: 'https://maps.app.goo.gl/example',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('allows an update containing only the Google Maps URL', async () => {
    const input = plainToInstance(UpdateVenueDto, {
      googleMapsUrl: 'https://www.google.com/maps/place/example',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it.each([
    'http://maps.google.com/example',
    'javascript:alert(1)',
    'maps.app.goo.gl/example',
  ])('rejects a non-HTTPS Google Maps URL: %s', async (googleMapsUrl) => {
    const input = plainToInstance(CreateVenueDto, {
      name: 'ตลาดทดสอบ',
      googleMapsUrl,
    });

    await expect(validate(input)).resolves.not.toHaveLength(0);
  });

  it('rejects a Google Maps URL longer than 500 characters', async () => {
    const input = plainToInstance(CreateVenueDto, {
      name: 'ตลาดทดสอบ',
      googleMapsUrl: `https://maps.example.com/${'a'.repeat(480)}`,
    });

    await expect(validate(input)).resolves.not.toHaveLength(0);
  });

  it('keeps the existing latitude and longitude validation', async () => {
    const valid = plainToInstance(CreateVenueDto, {
      name: 'ตลาดทดสอบ',
      latitude: '14.882936',
      longitude: '102.018120',
    });
    const invalid = plainToInstance(CreateVenueDto, {
      name: 'ตลาดทดสอบ',
      latitude: '14.8829367',
      longitude: 'not-a-coordinate',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
