import { IsOptional, IsUUID } from 'class-validator';

export class FindAllVenuesDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
