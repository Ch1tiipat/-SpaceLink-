import { IsOptional, Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';
import { CreatePenaltyDto } from './create-penalty.dto';

export class CreateAdminPenaltyDto extends CreatePenaltyDto {
  @Matches(UUID_SHAPE)
  organizationId!: string;

  @Matches(UUID_SHAPE)
  userId!: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  bookingId?: string;
}
