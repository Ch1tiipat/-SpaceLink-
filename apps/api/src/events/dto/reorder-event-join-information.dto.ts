import { ArrayNotEmpty, ArrayUnique, IsArray, Matches } from 'class-validator';
import { UUID_SHAPE } from '../../common/utils/uuid.util';

export class ReorderEventJoinInformationDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Matches(UUID_SHAPE, { each: true })
  ids!: string[];
}
