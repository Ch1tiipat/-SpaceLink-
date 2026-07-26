import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { SupabaseTokenService } from '../supabase-token.service';
import { UserProvisioningService } from '../user-provisioning.service';

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: User;
}

/**
 * First guard in the chain (AGENTS.md §7): verifies the Supabase token and
 * puts the provisioned `app_user` row on `req.user`. Rejects with 401.
 *
 * `req.user` is always a database record, never the raw token — role and
 * organization membership are read from it downstream, and taking them from a
 * claim would break tenant isolation.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: SupabaseTokenService,
    private readonly userProvisioning: UserProvisioningService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    // Throws UnauthorizedException on a bad signature, expiry, wrong audience
    // or a missing claim.
    const { sub, email } = await this.tokenService.verify(token);

    // Just-in-time provisioning (§7, step 4): the first verified token for an
    // auth_user_id we have not seen creates its `app_user` row.
    request.user = await this.userProvisioning.findOrCreate(sub, email);

    return true;
  }

  /** `Authorization: Bearer <token>`. Any other shape is treated as absent. */
  private extractBearerToken(header: string | undefined): string | null {
    if (!header) {
      return null;
    }

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }
}
