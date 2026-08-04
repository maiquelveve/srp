import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { RoleName } from '../../roles/entities/role.entity';

/** GET /api/v1/users?role=&unitId= (FR-021 roster filter, FR-004a scope). */
export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsInt()
  unitId?: number;
}
