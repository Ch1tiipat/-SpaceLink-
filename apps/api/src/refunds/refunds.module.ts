import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RefundsController],
  providers: [RefundsService],
})
export class RefundsModule {}
