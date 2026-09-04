import { ArrayMaxSize, ArrayMinSize, IsArray, Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export const MAX_BOOKINGS_PER_BATCH = 10;

export class CreateBookingsBatchDto {
  @Matches(UUID_SHAPE)
  eventId!: string;

  @Matches(UUID_SHAPE)
  shopId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BOOKINGS_PER_BATCH)
  @Matches(UUID_SHAPE, { each: true })
  boothIds!: string[];
}
