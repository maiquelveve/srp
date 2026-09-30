import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RoleName } from '../../roles/entities/role.entity';

/** PATCH /api/v1/users/:id (FR-003) — todo campo é opcional (atualização parcial). */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  /** Conserta um e-mail digitado errado na criação (checagem de duplicidade em UsersService.update()). */
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  badgeNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;
}
