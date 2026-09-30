import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoleName } from '../../roles/entities/role.entity';

/**
 * GET /api/v1/users?role=&unitId=&active=&search=&limit=&offset= (FR-021
 * roster filter, FR-004a scope; `active`/`search`/`limit`/`offset` — tela de
 * Administração de Usuários, feature 002).
 */
export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsInt()
  unitId?: number;

  /** 'true' | 'false' — omitido lista os dois estados (mesmo padrão de `includeInactive` em posts/movements). */
  @IsOptional()
  @IsBooleanString()
  active?: string;

  /** Substring, case-insensitive, contra nome/e-mail/matrícula. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
