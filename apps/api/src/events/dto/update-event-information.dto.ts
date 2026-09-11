import { PartialType } from '@nestjs/mapped-types';
import { CreateEventInformationDto } from './create-event-information.dto';

export class UpdateEventInformationDto extends PartialType(
  CreateEventInformationDto,
) {}
