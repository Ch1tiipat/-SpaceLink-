import { Controller, Get, Param, Query } from '@nestjs/common';
import { FindAllVenuesDto } from './dto/find-all-venues.dto';
import { VenuesService } from './venues.service';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get()
  findAll(@Query() query: FindAllVenuesDto) {
    return this.venuesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.venuesService.findOne(id);
  }
}
