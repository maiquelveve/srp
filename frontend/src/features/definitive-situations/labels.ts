import type { InmateStatus } from '../structure/types';
import type { SituationPeriod } from './types';

export const PERIOD_OPTIONS: { value: SituationPeriod; label: string; emptyLabel: string }[] = [
  { value: '6m', label: 'Últimos 6 meses', emptyLabel: 'nos últimos 6 meses' },
  { value: '1y', label: 'Último ano', emptyLabel: 'no último ano' },
  { value: '5y', label: 'Últimos 5 anos', emptyLabel: 'nos últimos 5 anos' },
  { value: 'all', label: 'Todo o período', emptyLabel: 'em todo o período' },
];

export const DEFAULT_PERIOD: SituationPeriod = '6m';

type BadgeVariant = 'secondary' | 'warning' | 'outline';

/** Rótulo e cor da situação vigente; só os três status que a tela lista. */
export const SITUATION_BADGE: Partial<Record<InmateStatus, { label: string; variant: BadgeVariant }>> = {
  RELEASED: { label: 'Liberdade', variant: 'secondary' },
  ANKLE_MONITOR: { label: 'Tornozeleira', variant: 'warning' },
  TRANSFERRED: { label: 'Transferência', variant: 'outline' },
};
