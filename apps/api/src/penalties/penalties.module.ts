import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PenaltiesAdminController } from './penalties-admin.controller';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PenaltiesController, PenaltiesAdminController],
  providers: [PenaltiesService],
})
export class PenaltiesModule {}
