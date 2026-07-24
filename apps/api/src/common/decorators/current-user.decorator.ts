import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { User } from '@prisma/client';

/**
 * Injects the authenticated `app_user` row placed on the request by
 * SupabaseAuthGuard. Only valid on handlers behind that guard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<{ user: User }>();
    return request.user;
  },
);
