import { IsOptional, IsUUID } from 'class-validator';

export class FindAllBoothsDto {
  @IsOptional()
  @IsUUID()
  zoneId?: string;
}
