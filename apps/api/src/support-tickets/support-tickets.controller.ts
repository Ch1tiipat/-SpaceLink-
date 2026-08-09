import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { OrgScoped } from '../auth/decorators/org-scoped.decorator';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApproveQuotaExceptionDto } from './dto/approve-quota-exception.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportTicketsService } from './support-tickets.service';

@Controller('support-tickets')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SupportTicketsController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  create(
    @Body() createSupportTicketDto: CreateSupportTicketDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.supportTicketsService.create(
      createSupportTicketDto,
      currentUser.id,
    );
  }

  // Org-scoped, so its effective guard chain is [SupabaseAuthGuard, RolesGuard,
  // SupabaseAuthGuard, OrgScopeGuard] — Nest runs controller-level guards before
  // route-level ones, and `@OrgScoped` bundles its own SupabaseAuthGuard. That
  // guard runs twice here, costing one extra token verification and one
  // idempotent `findOrCreate`. Accepted for the same reason BookingsController
  // accepts it: the alternatives are splitting `@OrgScoped` apart, which
  // AGENTS.md forbids outright, or dropping the class-level guards.
  @Patch(':ticketId/approve-quota-exception')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN)
  @OrgScoped('ticketId')
  approveQuotaException(
    @Param('ticketId') ticketId: string,
    @Body() approveQuotaExceptionDto: ApproveQuotaExceptionDto,
    @CurrentOrgId() orgId: string,
  ) {
    return this.supportTicketsService.approveQuotaException(
      ticketId,
      approveQuotaExceptionDto,
      orgId,
    );
  }
}
