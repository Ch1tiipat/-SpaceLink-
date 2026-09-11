import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateEventJoinInformationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(5000)
  content!: string;
}
