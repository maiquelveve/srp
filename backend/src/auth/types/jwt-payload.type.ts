import { RoleName } from '../../roles/entities/role.entity';

/** Access token claims (research.md #5) — carries role and unit scope for RBAC. */
export interface JwtPayload {
  sub: number;
  role: RoleName;
  units: number[];
}

export interface AuthenticatedRequest extends Express.Request {
  user: JwtPayload;
}
