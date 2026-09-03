import { BadRequestException, PipeTransform } from '@nestjs/common';
import { isLooseUuid } from '../utils/uuid.util';

export class LooseUuidPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (!isLooseUuid(value)) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }

    return value;
  }
}
