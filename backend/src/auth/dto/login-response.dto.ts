import { RoleName } from '../../roles/entities/role.entity';

export class LoginResponseUserDto {
  id: number;
  name: string;
  email: string;
  badgeNumber: string | null;
  jobTitle: string | null;
  role: RoleName;
  units: number[];
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: LoginResponseUserDto;
}
