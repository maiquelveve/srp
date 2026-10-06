import type { RoleName } from '@/features/structure/types';

export const ROLE_LABEL: Record<RoleName, string> = {
  PRISON_OFFICER: 'Policial Penal',
  SUPERVISOR: 'Supervisor',
  WARDEN: 'Chefia/Diretor',
};

export const ROLE_OPTIONS: { value: RoleName; label: string }[] = (
  Object.entries(ROLE_LABEL) as [RoleName, string][]
).map(([value, label]) => ({ value, label }));

/** Espelha UsersService (`MAX_UNITS_PER_USER`, backend) — a validação real mora lá. */
export const MAX_UNITS_PER_USER = 3;
