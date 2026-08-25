import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { validationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { SlipsModule } from './slips/slips.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { VenuesModule } from './venues/venues.module';
import { ZonesModule } from './zones/zones.module';
import { EventsModule } from './events/events.module';
import { BoothsModule } from './booths/booths.module';
import { BookingsModule } from './bookings/bookings.module';
import { ShopsModule } from './shops/shops.module';
import { CategoriesModule } from './categories/categories.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PenaltiesModule } from './penalties/penalties.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RefundsModule } from './refunds/refunds.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    PrismaModule,
    AuthModule,
    HealthModule,
    SlipsModule,
    AiModule,
    UsersModule,
    OrganizationsModule,
    VenuesModule,
    ZonesModule,
    EventsModule,
    BoothsModule,
    BookingsModule,
    ShopsModule,
    CategoriesModule,
    SupportTicketsModule,
    DashboardModule,
    AnnouncementsModule,
    ReviewsModule,
    PenaltiesModule,
    NotificationsModule,
    RefundsModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
