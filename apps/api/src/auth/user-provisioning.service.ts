import { Injectable } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Just-in-time provisioning of `app_user` (CLAUDE.md §7, step 4).
 *
 * Supabase Auth owns identity; it never writes to our database. The first time
 * a verified token arrives for an `auth_user_id` we have not seen, we create
 * the matching `app_user` row here. Role always starts at VENDOR — an elevated
 * role is granted later by a human, never inferred from a token claim.
 */
@Injectable()
export class UserProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(authUserId: string, email: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { authUserId },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.user.create({
        data: {
          authUserId,
          email,
          fullName: this.deriveFullName(email),
          role: UserRole.VENDOR,
        },
      });
    } catch (error) {
      // Two concurrent first requests for the same token both miss the read
      // above and both try to insert. The loser gets P2002; re-read so it
      // returns the row the winner just created instead of failing the request.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.user.findUnique({
          where: { authUserId },
        });
        if (raced) {
          return raced;
        }
      }
      // Anything else — including P2002 on `email`, which means this address is
      // already bound to a different auth_user_id — is a real error.
      throw error;
    }
  }

  /** `fullName` is non-null in the schema; default it to the email local part. */
  private deriveFullName(email: string): string {
    const localPart = email.split('@')[0];
    return localPart.length > 0 ? localPart : email;
  }
}
