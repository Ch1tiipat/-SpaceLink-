import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PenaltiesController],
  providers: [PenaltiesService],
})
export class PenaltiesModule {}
