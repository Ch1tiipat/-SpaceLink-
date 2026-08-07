import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * `ownerUserId` is deliberately absent: it comes from the authenticated user
 * that SupabaseAuthGuard put on the request, never from the body (§14.2).
 *
 * `logoUrl` is accepted and stored but nothing reads it yet — uploads land in
 * a later ticket. It is validated as a plain string rather than `@IsUrl`
 * because a Supabase Storage object path is not a URL.
 */
export class CreateShopDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  /**
   * A shop must sit in at least one product category — the category drives
   * which zones it can book into. `'all'` rather than `'4'` matches
   * CreateBookingDto, which does not pin a version either.
   */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  categoryIds!: string[];
}
