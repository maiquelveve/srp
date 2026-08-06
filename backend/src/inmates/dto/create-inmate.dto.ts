import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateInmateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

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

  /** URL only — upload/storage provider not yet decided (research.md #13). */
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @IsInt()
  currentCellId: number;
}
