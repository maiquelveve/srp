import { IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Never accepts status/currentCellId — those change only via contracts/movements.md. */
export class UpdateInmateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationId?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  custodyRegime?: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;
}
