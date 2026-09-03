import { IsOptional, Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class FindAllBoothsDto {
  @IsOptional()
  @Matches(UUID_SHAPE)
  zoneId?: string;
}
