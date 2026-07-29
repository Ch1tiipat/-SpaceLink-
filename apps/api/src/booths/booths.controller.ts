import { Controller, Get, Param, Query } from '@nestjs/common';
import { FindAllBoothsDto } from './dto/find-all-booths.dto';
import { BoothsService } from './booths.service';

@Controller('booths')
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}

  @Get()
  findAll(@Query() query: FindAllBoothsDto) {
    return this.boothsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boothsService.findOne(id);
  }
}
