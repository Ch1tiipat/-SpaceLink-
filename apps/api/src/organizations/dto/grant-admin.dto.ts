import { IsEmail } from 'class-validator';

export class GrantAdminDto {
  @IsEmail()
  email!: string;
}
