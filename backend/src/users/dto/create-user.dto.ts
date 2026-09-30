import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RoleName } from '../../roles/entities/role.entity';

/** FR-030 — only WARDEN can call POST /api/v1/users with this shape. */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  badgeNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @IsEnum(RoleName)
  role: RoleName;

  /** Máximo 3 lotações simultâneas (checagem real em UsersService.create()). */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  unitIds: number[];
}
