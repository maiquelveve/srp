import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EyeIcon } from 'lucide-react';
import { reportsApi } from '../api';
import { formatDateTime } from '../format';
import {
  AUDIT_ACTION_BADGE_VARIANT,
  AUDIT_ACTION_LABEL,
  AUDIT_TABLE_OPTIONS,
  auditTableLabel,
} from '../labels';
import { useNotifyOnError } from '../hooks/useReportQuery';
import PaginationBar from '../components/PaginationBar';
import ReportTable from '../components/ReportTable';
import AuditDetailsDialog from './components/AuditDetailsDialog';
import DatePicker from '@/features/routines/components/DatePicker';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 25;
const ALL_TABLES = 'ALL';

interface AppliedFilters {
  table: string;
  recordId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: AppliedFilters = { table: ALL_TABLES, recordId: '', from: '', to: '' };

/** Início do dia local em ISO; a API compara com `timestamptz`. */
function startOfDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toISOString();
}

function endOfDay(isoDate: string): string {
  return new Date(`${isoDate}T23:59:59.999`).toISOString();
}

/**
 * Trilha de auditoria (User Story 6, FR-026/FR-027): somente leitura, sem
 * nenhuma ação de edição ou exclusão. Acesso só para SUPERVISOR/WARDEN
 * (FR-028) e restrito às unidades do usuário pela API (FR-004a).
 */
export default function AuditPage(): JSX.Element {
  const { user } = useAuth();
  const canViewAudit = user?.role === 'SUPERVISOR' || user?.role === 'WARDEN';

  const [draft, setDraft] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ['audit', applied, page],
    queryFn: () =>
      reportsApi.listAudit({
        table: applied.table === ALL_TABLES ? undefined : applied.table,
        recordId: applied.recordId ? Number(applied.recordId) : undefined,
        from: applied.from ? startOfDay(applied.from) : undefined,
        to: applied.to ? endOfDay(applied.to) : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    enabled: canViewAudit,
  });
  useNotifyOnError(query.isError, 'Auditoria');

  if (!canViewAudit) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acesso restrito a Supervisor e Chefia/Diretor.</p>
      </div>
    );
  }

  const total = query.data?.total ?? 0;

  const rows = (query.data?.data ?? []).map((entry) => [
    formatDateTime(entry.timestamp),
    entry.userName ?? '-',
    <Badge key="action" variant={AUDIT_ACTION_BADGE_VARIANT[entry.action]}>
      {AUDIT_ACTION_LABEL[entry.action]}
    </Badge>,
    auditTableLabel(entry.affectedTable),
    <AuditDetailsDialog key="details" entry={entry}>
      <Button variant="ghost" size="icon" aria-label="Ver detalhes">
        <EyeIcon />
      </Button>
    </AuditDetailsDialog>,
  ]);

  function handleSearch(): void {
    setApplied(draft);
    setPage(0);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-[180px] gap-1.5">
          <Label htmlFor="audit-table">Tabela</Label>
          <Select value={draft.table} onValueChange={(table) => setDraft({ ...draft, table })}>
            <SelectTrigger id="audit-table">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TABLES}>Todas</SelectItem>
              {AUDIT_TABLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-32 gap-1.5">
          <Label htmlFor="audit-record">ID do item</Label>
          <Input
            id="audit-record"
            inputMode="numeric"
            placeholder="ID"
            value={draft.recordId}
            onChange={(event) =>
              setDraft({ ...draft, recordId: event.target.value.replace(/\D/g, '') })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-from">De</Label>
          <DatePicker
            id="audit-from"
            value={draft.from}
            onChange={(from) => setDraft({ ...draft, from })}
            className="w-48"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-to">Até</Label>
          <DatePicker
            id="audit-to"
            value={draft.to}
            onChange={(to) => setDraft({ ...draft, to })}
            className="w-48"
          />
        </div>
        <div className="ml-auto flex items-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setApplied(EMPTY_FILTERS);
              setPage(0);
            }}
          >
            Limpar
          </Button>
          <Button onClick={handleSearch}>Pesquisar</Button>
        </div>
      </div>

      <ReportTable
        columns={['Data e hora', 'Usuário', 'Ação', 'Tabela', 'Detalhes']}
        rows={rows}
        isLoading={query.isLoading}
        emptyMessage="Nenhum registro de auditoria encontrado."
      />

      <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}
