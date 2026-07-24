import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * First guard in the chain (CLAUDE.md §7): verifies the Supabase token and
 * puts the provisioned `app_user` row on `req.user`. Rejects with 401.
 */
@Injectable()
export class SupabaseAuthGuard extends AuthGuard('supabase-jwt') {}
