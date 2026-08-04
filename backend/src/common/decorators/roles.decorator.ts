import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../../roles/entities/role.entity';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles (FR-001…FR-004a) — checked by RolesGuard. */
export const Roles = (...roles: RoleName[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
