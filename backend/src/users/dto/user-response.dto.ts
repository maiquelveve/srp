import { RoleName } from '../../roles/entities/role.entity';
import { User } from '../entities/user.entity';

/** Never includes passwordHash (Constitution II). */
export class UserResponseDto {
  id: number;
  name: string;
  email: string;
  role: RoleName;
  jobTitle: string | null;
  badgeNumber: string | null;
  units: number[];
  active: boolean;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.role = user.role.name;
    dto.jobTitle = user.jobTitle;
    dto.badgeNumber = user.badgeNumber;
    dto.units = (user.units ?? []).map((unit) => unit.id);
    dto.active = user.active;
    return dto;
  }
}
