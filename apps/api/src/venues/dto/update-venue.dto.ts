import { PartialType } from '@nestjs/mapped-types';
import { VenueStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateVenueDto } from './create-venue.dto';

export class UpdateVenueDto extends PartialType(CreateVenueDto) {
  @IsOptional()
  @IsEnum(VenueStatus)
  status?: VenueStatus;
}
