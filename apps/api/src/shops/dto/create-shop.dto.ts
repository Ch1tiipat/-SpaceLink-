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
 * `logoUrl` is accepted and stored as a plain string. It is **not** how a logo
 * gets uploaded — that is `POST /shops/me/logo`, which stores the file itself
 * and overwrites this field with the URL it built. Nothing in the web app sends
 * `logoUrl` here.
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
