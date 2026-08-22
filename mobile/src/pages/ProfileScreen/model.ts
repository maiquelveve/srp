import type { RoleName } from '@/contexts/auth-context';

const ROLE_LABEL: Record<RoleName, string> = {
  PRISON_OFFICER: 'Policial Penal',
  SUPERVISOR: 'Supervisor',
  WARDEN: 'Chefia/Diretor',
};

/** Local à tela — não existe hoje um domínio "auth" compartilhado (research.md #32). */
export function roleLabel(role: RoleName): string {
  return ROLE_LABEL[role];
}
