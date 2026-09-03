import { IsOptional, IsString, Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Matches(UUID_SHAPE)
  actorUserId?: string;
}
