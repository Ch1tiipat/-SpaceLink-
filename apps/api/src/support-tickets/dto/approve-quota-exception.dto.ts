import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Approving grants permission, not a booth. There is deliberately no `eventId`
 * or `boothId`: pre-selecting a booth on the vendor's behalf would let an
 * approval jump the queue ahead of another vendor booking that same booth in
 * real time, so the vendor returns to the normal flow and picks one themselves.
 */
export class ApproveQuotaExceptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
