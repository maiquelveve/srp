import { RoleName } from '../../roles/entities/role.entity';

/** Access token claims (research.md #5) — carries role and unit scope for RBAC. */
export interface JwtPayload {
  sub: number;
  role: RoleName;
  units: number[];
  /**
   * Issued-at (seconds since epoch) — not set by us, added automatically by
   * `jsonwebtoken` on sign and injected into the decoded payload by
   * `passport-jwt` before `JwtStrategy.validate()` runs. Used to reject a
   * token issued before the user's last password change (FR-017a).
   */
  iat?: number;
}

export interface AuthenticatedRequest extends Express.Request {
  user: JwtPayload;
}
