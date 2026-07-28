import { Controller, Get, Param } from '@nestjs/common';
import { BoothsService } from './booths.service';

@Controller('booths')
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}

  @Get()
  findAll() {
    return this.boothsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boothsService.findOne(id);
  }
}
