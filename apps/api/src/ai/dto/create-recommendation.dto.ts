import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
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

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  limit?: number;
}
