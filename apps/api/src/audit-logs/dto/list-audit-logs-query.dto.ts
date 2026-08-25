import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;
}
