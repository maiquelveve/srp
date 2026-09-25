import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileTextIcon, SearchIcon, Undo2Icon, XIcon } from 'lucide-react';
import { definitiveSituationsApi } from './api';
import { DEFAULT_PERIOD, PERIOD_OPTIONS, SITUATION_BADGE } from './labels';
import type { SituationPeriod } from './types';
import { structureApi } from '../structure/api';
import ReasonDialog from './components/ReasonDialog';
import ReversalDialog from '../movements/components/ReversalDialog';
import { formatDateTime } from '../reports/format';
import { REPORT_PAGE_SIZE, usePagedState } from '../reports/hooks/usePagedState';
import { useNotifyOnError } from '../reports/hooks/useReportQuery';
import { useSelectedUnit } from '../reports/hooks/useSelectedUnit';
import PaginationBar from '../reports/components/PaginationBar';
import ReportTable from '../reports/components/ReportTable';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Filters {
  period: SituationPeriod;
  name: string;
  registrationId: string;
}

const DEFAULT_FILTERS: Filters = { period: DEFAULT_PERIOD, name: '', registrationId: '' };

/**
 * Situações definitivas (US3, FR-016a): onde a Chefia/Diretor encontra uma
 * liberdade, tornozeleira ou transferência registrada por engano e reverte.
 * Lista paginada no servidor (só cresce com o tempo), começando pelos últimos
 * 6 meses. Acesso só da Chefia/Diretor; a API também responde 403 aos demais.
 */
export default function DefinitiveSituationsPage(): JSX.Element {
  const { user } = useAuth();
  const canView = user?.role === 'WARDEN';
  const { unitId, setUnitId, units } = useSelectedUnit();

  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = usePagedState(`${unitId}|${applied.period}|${applied.name}|${applied.registrationId}`);

  const situationsQuery = useQuery({
    queryKey: ['definitive-situations', unitId, applied, page],
    queryFn: () =>
      definitiveSituationsApi.list({
        unitId: unitId as number,
        period: applied.period,
        name: applied.name.trim() || undefined,
        registrationId: applied.registrationId.trim() || undefined,
        limit: REPORT_PAGE_SIZE,
        offset: page * REPORT_PAGE_SIZE,
      }),
    enabled: canView && unitId !== null,
    placeholderData: keepPreviousData,
  });
  useNotifyOnError(situationsQuery.isError, 'Situações definitivas');

  // Galerias da unidade: o diálogo de reversão escolhe a cela de destino entre elas.
  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleries(unitId as number),
    enabled: canView && unitId !== null,
  });
  const galleries = galleriesQuery.data?.data ?? [];

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acesso restrito à Chefia/Diretor.</p>
      </div>
    );
  }

  function handleSearch(event: FormEvent): void {
    event.preventDefault();
    setApplied(draft);
  }

  function handleClear(): void {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  }

  const hasTextFilter = applied.name.trim() !== '' || applied.registrationId.trim() !== '';
  const periodOption = PERIOD_OPTIONS.find((option) => option.value === applied.period);
  const emptyMessage = hasTextFilter
    ? 'Nenhuma situação definitiva encontrada com esses filtros.'
    : `Nenhuma situação definitiva ${periodOption?.emptyLabel ?? 'no período'}.`;

  const rows = (situationsQuery.data?.data ?? []).map((item) => {
    const badge = SITUATION_BADGE[item.status];
    return [
      <div key="inmate" className="min-w-[180px]">
        <p className="font-medium uppercase">{item.inmateName}</p>
        <p className="text-xs text-muted-foreground">
          {item.registrationId ? `Matrícula ${item.registrationId}` : 'Sem matrícula'}
        </p>
      </div>,
      <Badge key="status" variant={badge?.variant ?? 'secondary'} className="whitespace-nowrap">
        {badge?.label ?? item.situation}
      </Badge>,
      <span key="date" className="whitespace-nowrap">
        {formatDateTime(item.registeredAt)}
      </span>,
      item.registeredByName,
      // Uma linha só, com "..." no fim: motivo longo não pode quebrar o alinhamento da tabela.
      <div key="reason" className="flex items-center justify-center gap-1.5">
        <span className="block w-[220px] truncate text-center text-muted-foreground" title={item.reason ?? undefined}>
          {item.reason ?? '-'}
        </span>
        <ReasonDialog situation={item}>
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Ver motivo completo">
            <FileTextIcon className="size-4" />
          </Button>
        </ReasonDialog>
      </div>,
      <ReversalDialog key="action" inmate={{ id: item.inmateId, name: item.inmateName, registrationId: item.registrationId }} galleries={galleries}>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Undo2Icon className="size-3.5" />
          Reverter
        </Button>
      </ReversalDialog>,
    ];
  });

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Liberdades, tornozeleiras e transferências</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Encontre um registro feito por engano e use Reverter para o preso voltar a ativo em uma cela com vaga. O
          registro original continua no histórico.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4"
      >
        <div className="grid min-w-[200px] gap-1.5">
          <Label htmlFor="situations-unit">Unidade</Label>
          <Select value={unitId ? String(unitId) : ''} onValueChange={(value) => setUnitId(Number(value))}>
            <SelectTrigger id="situations-unit">
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={String(unit.id)}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[180px] gap-1.5">
          <Label htmlFor="situations-period">Data do registro</Label>
          <Select value={draft.period} onValueChange={(value) => setDraft({ ...draft, period: value as SituationPeriod })}>
            <SelectTrigger id="situations-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[220px] flex-1 gap-1.5">
          <Label htmlFor="situations-name">Nome do preso</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="situations-name"
              className="pl-9"
              placeholder="Parte do nome"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>
        </div>

        <div className="grid min-w-[160px] gap-1.5">
          <Label htmlFor="situations-code">Matrícula</Label>
          <Input
            id="situations-code"
            placeholder="Matrícula do preso"
            value={draft.registrationId}
            onChange={(event) => setDraft({ ...draft, registrationId: event.target.value })}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button type="submit" className="gap-1.5">
            <SearchIcon className="size-4" />
            Pesquisar
          </Button>
          <Button type="button" variant="ghost" onClick={handleClear} className="gap-1.5">
            <XIcon className="size-4" />
            Limpar
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        <ReportTable
          columns={['Preso', 'Situação', 'Registrada em', 'Registrada por', 'Motivo', 'Ação']}
          rows={rows}
          isLoading={situationsQuery.isLoading}
          emptyMessage={emptyMessage}
        />
        <PaginationBar
          page={page}
          pageSize={REPORT_PAGE_SIZE}
          total={situationsQuery.data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
