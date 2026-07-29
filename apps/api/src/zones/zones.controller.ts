import { Controller, Get, Param, Query } from '@nestjs/common';
import { FindAllZonesDto } from './dto/find-all-zones.dto';
import { ZonesService } from './zones.service';

@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  findAll(@Query() query: FindAllZonesDto) {
    return this.zonesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.zonesService.findOne(id);
  }
}
