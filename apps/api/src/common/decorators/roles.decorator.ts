import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Declares which platform roles may reach a handler, e.g. `@Roles(UserRole.ORG_ADMIN)`.
 * Read by RolesGuard, which compares against the role stored in our database.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
