import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

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
   * which zones it can book into. UUID shape validation also accepts the
   * legacy category ids that PostgreSQL already stores.
   */
  @IsArray()
  @ArrayMinSize(1)
  @Matches(UUID_SHAPE, { each: true })
  categoryIds!: string[];
}
