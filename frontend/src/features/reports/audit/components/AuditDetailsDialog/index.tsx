import type { ReactNode } from 'react';
import {
  CalendarIcon,
  FileTextIcon,
  HashIcon,
  HistoryIcon,
  LogInIcon,
  LogOutIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { formatDateTime, formatIsoDate } from '../../../format';
import {
  AUDIT_ACTION_BADGE_VARIANT,
  AUDIT_ACTION_LABEL,
  AUDIT_FIELD_LABEL,
  AUDIT_VALUE_LABEL,
  auditTableLabel,
} from '../../../labels';
import type { AuditAction, AuditLogEntry } from '../../../types';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Ícone e cor (tokens semânticos) de cada ação, no mesmo mapeamento de cor dos `Badge`s da tabela. */
const ACTION_STYLE: Record<AuditAction, { icon: LucideIcon; tone: string }> = {
  INSERT: { icon: PlusIcon, tone: 'bg-success/15 text-success' },
  UPDATE: { icon: PencilIcon, tone: 'bg-warning/15 text-warning' },
  DELETE: { icon: Trash2Icon, tone: 'bg-destructive/15 text-destructive' },
  LOGIN: { icon: LogInIcon, tone: 'bg-info/15 text-info' },
  LOGOUT: { icon: LogOutIcon, tone: 'bg-info/15 text-info' },
  LOGIN_FAILED: { icon: ShieldAlertIcon, tone: 'bg-destructive/15 text-destructive' },
};

/** Valor de um campo auditado em texto legível: nulo, sim/não, data/hora e enumerados traduzidos. */
function formatValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">-</span>;
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string') {
    if (ISO_DATE_TIME.test(value)) return formatDateTime(value);
    if (ISO_DATE.test(value)) return formatIsoDate(value);
    return AUDIT_VALUE_LABEL[value] ?? value;
  }
  if (typeof value === 'object') {
    return (
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted px-2 py-1.5 text-left text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return String(value);
}

/** Bloco de informação do cabeçalho: ícone, rótulo em caixa alta e valor. */
function MetaTile({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
        <Icon className="size-4" />
      </span>
      <div className="grid min-w-0">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="break-words text-sm font-medium">{children}</span>
      </div>
    </div>
  );
}

/** Seção de dados: título com ícone e uma linha por campo, rótulo à esquerda e valor à direita. */
function DataSection({
  icon: Icon,
  title,
  data,
  emptyText,
}: {
  icon: LucideIcon;
  title: string;
  data: Record<string, unknown> | null;
  emptyText: string;
}): JSX.Element {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <h3 className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h3>
      {data ? (
        <dl className="divide-y divide-border">
          {Object.entries(data).map(([field, value]) => (
            <div
              key={field}
              className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4"
            >
              <dt className="text-muted-foreground">{AUDIT_FIELD_LABEL[field] ?? field}</dt>
              <dd className="min-w-0 break-words font-medium sm:text-right">
                {formatValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  );
}

/** Por que os dados do registro podem estar vazios (o interceptor só guarda o valor novo). */
function emptyMessage(action: AuditAction): string {
  return action === 'DELETE' ? 'Não se aplica (registro removido)' : 'Não registrado';
}

/**
 * Detalhe de uma linha da auditoria (FR-026): ação em destaque, quem/quando/
 * qual item e os dados do registro em seções. Campos sensíveis já vêm como
 * "[REDACTED]".
 */
export default function AuditDetailsDialog({
  entry,
  children,
}: {
  entry: AuditLogEntry;
  children: ReactNode;
}): JSX.Element {
  const { icon: ActionIcon, tone } = ACTION_STYLE[entry.action];

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-5 overflow-y-auto">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-center gap-4 pr-6">
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${tone}`}
            >
              <ActionIcon className="size-6" />
            </span>
            <div className="grid min-w-0 gap-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
                {AUDIT_ACTION_LABEL[entry.action]}
                <Badge variant={AUDIT_ACTION_BADGE_VARIANT[entry.action]}>
                  {auditTableLabel(entry.affectedTable)}
                </Badge>
              </DialogTitle>
              <DialogDescription>Registro de auditoria, somente leitura</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1.5fr_1.2fr_1fr]">
          <MetaTile icon={CalendarIcon} label="Data e hora">
            {formatDateTime(entry.timestamp)}
          </MetaTile>
          <MetaTile icon={UserIcon} label="Usuário">
            {entry.userName ?? '-'}
          </MetaTile>
          <MetaTile icon={HashIcon} label="ID do item">
            {entry.recordId ?? '-'}
          </MetaTile>
        </div>

        <DataSection
          icon={FileTextIcon}
          title="Dados do registro"
          data={entry.newData}
          emptyText={emptyMessage(entry.action)}
        />
        {entry.oldData && (
          <DataSection
            icon={HistoryIcon}
            title="Valores anteriores"
            data={entry.oldData}
            emptyText=""
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
