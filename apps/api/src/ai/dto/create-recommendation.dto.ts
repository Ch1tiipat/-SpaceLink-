import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRecommendationDto {
  /** The shop this vendor intends to create the booking for. */
  @IsUUID()
  shopId!: string;

  /**
   * Optional subset of the selected shop's categories. Omitting it ranks with
   * every category attached to the shop.
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  productCategoryIds?: string[];

  /** Optional zone selected by the vendor in the assistant flow. */
  @IsOptional()
  @IsUUID()
  preferredZoneId?: string;

  /** Public booth facilities the vendor would like the recommender to match. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  requiredFacilities?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  limit?: number;
}
