import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../reports/dto/reports-query.dto';

/** Período da data de registro da situação definitiva (FR-016a); padrão `6m`. */
export enum DefinitiveSituationPeriod {
  SIX_MONTHS = '6m',
  ONE_YEAR = '1y',
  FIVE_YEARS = '5y',
  ALL = 'all',
}

/**
 * `GET /api/v1/movements/definitive-situations?unitId=&period=&name=&registrationId=&limit=&offset=`
 * (FR-016a, contracts/movements.md).
 */
export class DefinitiveSituationsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsInt()
  unitId?: number;

  @IsOptional()
  @IsEnum(DefinitiveSituationPeriod)
  period?: DefinitiveSituationPeriod;

  /** Parte do nome do preso, sem diferenciar maiúsculas de minúsculas. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  /** Parte da matrícula do preso (`registrationId`). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationId?: string;
}
