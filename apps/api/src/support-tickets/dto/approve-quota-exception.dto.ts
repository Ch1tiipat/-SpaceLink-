import { Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class ApproveQuotaExceptionDto {
  @Matches(UUID_SHAPE)
  eventId!: string;

  @Matches(UUID_SHAPE)
  boothId!: string;
}
