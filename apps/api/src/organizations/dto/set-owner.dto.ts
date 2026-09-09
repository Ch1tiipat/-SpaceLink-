import { IsEmail } from 'class-validator';

export class SetOwnerDto {
  @IsEmail()
  email!: string;
}
