import { IsOptional, Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class FindAllZonesDto {
  @IsOptional()
  @Matches(UUID_SHAPE)
  venueId?: string;
}
