import { AnnouncementType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * `organizationId` is deliberately absent: admin routes take it from the
 * organization that `@OrgScoped('organizationId')` already verified, never
 * from the request body (AGENTS.md §14.2).
 */
export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @IsOptional()
  @IsUUID()
  eventId?: string | null;
}
