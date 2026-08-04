import { Module } from '@nestjs/common';
import { BoothsService } from './booths.service';
import { BoothsController } from './booths.controller';

@Module({
  controllers: [BoothsController],
  providers: [BoothsService],
  exports: [BoothsService],
})
export class BoothsModule {}
