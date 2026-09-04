import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Matches(/^-?\d{1,3}(\.\d{1,6})?$/)
  latitude?: string;

  @IsOptional()
  @Matches(/^-?\d{1,3}(\.\d{1,6})?$/)
  longitude?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mapImageUrl?: string;
}
