import { IsUrl } from 'class-validator';

export class DeletePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  endpoint!: string;
}
