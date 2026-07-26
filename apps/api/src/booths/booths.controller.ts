import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { BoothsService } from './booths.service';
import { CreateBoothDto } from './dto/create-booth.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';

@Controller('booths')
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}

  @Post()
  create(@Body() createBoothDto: CreateBoothDto) {
    return this.boothsService.create(createBoothDto);
  }

  @Get()
  findAll() {
    return this.boothsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boothsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBoothDto: UpdateBoothDto) {
    return this.boothsService.update(id, updateBoothDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.boothsService.remove(id);
  }
}
