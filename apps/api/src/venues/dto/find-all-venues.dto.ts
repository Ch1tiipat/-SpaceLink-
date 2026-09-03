import { IsOptional, Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class FindAllVenuesDto {
  @IsOptional()
  @Matches(UUID_SHAPE)
  organizationId?: string;
}
