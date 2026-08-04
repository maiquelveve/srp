import { RoleName } from '../../roles/entities/role.entity';

export class LoginResponseUserDto {
  id: number;
  name: string;
  role: RoleName;
  units: number[];
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: LoginResponseUserDto;
}
