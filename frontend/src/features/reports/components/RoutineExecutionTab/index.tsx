import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api';
import { formatIsoDate } from '../../format';
import { REPORT_PAGE_SIZE, usePagedState } from '../../hooks/usePagedState';
import { useNotifyOnError } from '../../hooks/useReportQuery';
import { REPORT_HELP } from '../../helpContent';
import PaginationBar from '../PaginationBar';
import PeriodSelect from '../PeriodSelect';
import ReportFilters from '../ReportFilters';
import ReportTable from '../ReportTable';
import { Badge } from '@/components/ui/badge';

const ROUTINE_PERIOD_DAYS_OPTIONS = [7, 15, 30, 90];

/**
 * Rotinas programadas no período por galeria (FR-025). Só há ocorrências
 * programadas e suprimidas (desativação por data): o sistema não registra a
 * execução real de uma rotina coletiva, então não há cumprimento nem atraso.
 */
export default function RoutineExecutionTab({ unitId }: { unitId: number | null }): JSX.Element {
  const [days, setDays] = useState(7);
  const [page, setPage] = usePagedState(`${unitId}|${days}`);
  const query = useQuery({
    queryKey: ['report', 'routine-execution', unitId, days, page],
    queryFn: () =>
      reportsApi.routineExecution({
        unitId: unitId as number,
        days,
        limit: REPORT_PAGE_SIZE,
        offset: page * REPORT_PAGE_SIZE,
      }),
    enabled: unitId !== null,
    placeholderData: keepPreviousData,
  });
  useNotifyOnError(query.isError, 'Execução de rotinas');

  const rows = (query.data?.data ?? []).map((item) => [
    item.routineName,
    item.galleryCode,
    item.scheduledOccurrences,
    item.skippedOccurrences > 0 ? (
      <Badge key="skipped" variant="warning">
        {item.skippedOccurrences}
      </Badge>
    ) : (
      0
    ),
  ]);

  return (
    <div className="space-y-4">
      <ReportFilters help={REPORT_HELP.routines}>
        <PeriodSelect
          id="routine-days"
          label="Período"
          value={days}
          options={ROUTINE_PERIOD_DAYS_OPTIONS}
          unit="dias"
          onChange={setDays}
        />
        {query.data && (
          <p className="pb-2 text-sm text-muted-foreground">
            De {formatIsoDate(query.data.from)} a {formatIsoDate(query.data.to)}
          </p>
        )}
      </ReportFilters>
      <ReportTable
        columns={['Rotina', 'Galeria', 'Ocorrências programadas', 'Desativadas por data']}
        rows={rows}
        isLoading={query.isLoading}
        emptyMessage="Nenhuma rotina cadastrada para a unidade."
      />
      <PaginationBar
        page={page}
        pageSize={REPORT_PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />
      <p className="text-sm text-muted-foreground">
        O sistema não registra quando uma rotina coletiva acontece. O relatório mostra o que estava
        programado e o que foi desativado para uma data específica.
      </p>
    </div>
  );
}
