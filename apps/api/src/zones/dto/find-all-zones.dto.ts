import { IsOptional, IsUUID } from 'class-validator';

export class FindAllZonesDto {
  @IsOptional()
  @IsUUID()
  venueId?: string;
}
