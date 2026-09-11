import { PartialType } from '@nestjs/mapped-types';
import { CreateEventJoinInformationDto } from './create-event-join-information.dto';

export class UpdateEventJoinInformationDto extends PartialType(
  CreateEventJoinInformationDto,
) {}
