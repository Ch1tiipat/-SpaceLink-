import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
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
}
