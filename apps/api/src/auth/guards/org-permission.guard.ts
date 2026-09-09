import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole, type User, UserRole } from '@prisma/client';
import type { OrgScopedRequest } from '../../common/decorators/current-org-id.decorator';
import {
  ORG_PERMISSION_KEY,
  type OrgPermission,
} from '../../common/decorators/org-permission.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface PermissionRequest extends OrgScopedRequest {
  user?: User;
}

@Injectable()
export class OrgPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<
      OrgPermission | undefined
    >(ORG_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!permission) return true;

    const request = context.switchToHttp().getRequest<PermissionRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException(
        'Organization permission requires authentication',
      );
    }
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (!request.organizationId) {
      throw new InternalServerErrorException(
        'Organization permission requires @OrgScoped()',
      );
    }

    const membership = await this.prisma.orgMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: request.organizationId,
          userId: user.id,
        },
      },
      select: {
        role: true,
        canManagePayments: true,
        canManageZones: true,
      },
    });

    if (membership?.role === MembershipRole.OWNER) return true;

    const allowed =
      permission === 'payments'
        ? membership?.canManagePayments
        : membership?.canManageZones;
    if (!allowed) {
      throw new ForbiddenException(
        permission === 'payments'
          ? 'คุณไม่มีสิทธิ์ดูแลงานการเงินขององค์กรนี้'
          : 'คุณไม่มีสิทธิ์ดูแลโซนขององค์กรนี้',
      );
    }

    return true;
  }
}
