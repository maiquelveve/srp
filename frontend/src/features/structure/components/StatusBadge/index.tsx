import { Badge } from '@/components/ui/badge';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  RELEASED: 'Liberdade',
  ANKLE_MONITOR: 'Tornozeleira',
  TRANSFERRED: 'Transferido',
  DECEASED: 'Óbito',
};

export default function StatusBadge({ status }: { status: string }): JSX.Element {
  const isActive = status === 'ACTIVE';
  return (
    <Badge variant={isActive ? 'success' : 'secondary'}>{STATUS_LABEL[status] ?? status}</Badge>
  );
}
