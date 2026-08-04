import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetInitialPasswordDto {
  @IsString()
  @IsNotEmpty()
  inviteToken: string;

  @IsString()
  @MinLength(8)
  password: string;
}
