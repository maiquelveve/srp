import type { RoleName } from '@/features/structure/types';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: RoleName;
  jobTitle: string | null;
  badgeNumber: string | null;
  units: number[];
  active: boolean;
  /** Só vem preenchido na resposta de POST /users (FR-002a) — ausente nas demais. */
  emailDelivered?: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  badgeNumber?: string;
  jobTitle?: string;
  role: RoleName;
  unitIds: number[];
}

export interface UpdateUserInput {
  name?: string;
  /** Corrige um e-mail digitado errado no cadastro — a API valida duplicidade (409). */
  email?: string;
  badgeNumber?: string;
  jobTitle?: string;
  role?: RoleName;
}

/** PATCH /reset-password e POST /resend-password-email (FR-002a/FR-007a). */
export interface PasswordActionResult {
  message: string;
  emailDelivered: boolean;
}
