import type { User, UserRole } from '@prisma/client';

export interface UserResponse {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  isBlacklisted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The single place an `app_user` row becomes a client-facing profile.
 *
 * The point of listing every field by hand rather than spreading the row is
 * `blacklistReason`, which is admin-facing only (§14.5) and would otherwise
 * ride along silently. A field added to the model in future is invisible here
 * until someone adds it deliberately, which is the safe direction.
 *
 * GET /auth/me and PATCH /users/me both go through this, so the two can never
 * drift into returning different profile shapes.
 */
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    authUserId: user.authUserId,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    isBlacklisted: user.isBlacklisted,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
