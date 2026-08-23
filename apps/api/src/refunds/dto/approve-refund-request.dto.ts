import { Matches } from 'class-validator';

export class ApproveRefundRequestDto {
  @Matches(/^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
  approvedAmount!: string;
}
