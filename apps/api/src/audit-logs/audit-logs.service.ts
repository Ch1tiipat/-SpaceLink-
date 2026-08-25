import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditLogInput {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonObject;
}

const auditLogSelect = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditLogResponse = Prisma.AuditLogGetPayload<{
  select: typeof auditLogSelect;
}>;

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Best-effort write that must run after the primary write has committed.
   * Metadata is deliberately excluded from the error log.
   */
  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          metadata: input.metadata,
        },
      });
    } catch {
      this.logger.error(
        `Failed to write audit log for action "${input.action}"`,
      );
    }
  }

  async findAll(filter: {
    action?: string;
    actorUserId?: string;
  }): Promise<AuditLogResponse[]> {
    return this.prisma.auditLog.findMany({
      where: {
        ...(filter.action ? { action: filter.action } : {}),
        ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
      },
      select: auditLogSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForActor(actorUserId: string): Promise<AuditLogResponse[]> {
    return this.prisma.auditLog.findMany({
      where: { actorUserId },
      select: auditLogSelect,
      orderBy: { createdAt: 'desc' },
    });
  }
}
