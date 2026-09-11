import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportTicketsController } from './support-tickets.controller';
import { SupportTicketsService } from './support-tickets.service';

@Module({
  // BookingsModule is gone with SCRUM-182: approving a quota exception grants
  // permission instead of creating a booking, so this module no longer reaches
  // into the booking path at all. AuditLogsModule exports AuditLogsService,
  // which records who decided each request.
  imports: [NotificationsModule, AuditLogsModule],
  controllers: [SupportTicketsController],
  providers: [SupportTicketsService],
})
export class SupportTicketsModule {}
