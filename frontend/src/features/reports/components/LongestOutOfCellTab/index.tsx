import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api';
import { formatHours } from '../../format';
import { PERIOD_DAYS_OPTIONS } from '../../labels';
import { REPORT_PAGE_SIZE, usePagedState } from '../../hooks/usePagedState';
import { useNotifyOnError } from '../../hooks/useReportQuery';
import { REPORT_HELP } from '../../helpContent';
import PaginationBar from '../PaginationBar';
import PeriodSelect from '../PeriodSelect';
import ReportFilters from '../ReportFilters';
import ReportTable from '../ReportTable';
import { Badge } from '@/components/ui/badge';

/** Presos com maior tempo fora da cela no período (FR-025); saídas ainda em aberto contam até agora. */
export default function LongestOutOfCellTab({ unitId }: { unitId: number | null }): JSX.Element {
  const [days, setDays] = useState(30);
  const [page, setPage] = usePagedState(`${unitId}|${days}`);
  const query = useQuery({
    queryKey: ['report', 'longest-out-of-cell', unitId, days, page],
    queryFn: () =>
      reportsApi.longestOutOfCell({
        unitId: unitId as number,
        days,
        limit: REPORT_PAGE_SIZE,
        offset: page * REPORT_PAGE_SIZE,
      }),
    enabled: unitId !== null,
    placeholderData: keepPreviousData,
  });
  useNotifyOnError(query.isError, 'Maior tempo fora da cela');

  const rows = (query.data?.data ?? []).map((item, index) => [
    page * REPORT_PAGE_SIZE + index + 1,
    <span key="name" className="uppercase">
      {item.inmateName}
    </span>,
    formatHours(item.hoursOut),
    item.openMovementCount > 0 ? (
      <Badge variant="warning">Fora da cela agora</Badge>
    ) : (
      <Badge variant="secondary">Retornou</Badge>
    ),
  ]);

  return (
    <div className="space-y-4">
      <ReportFilters help={REPORT_HELP.longestOut}>
        <PeriodSelect
          id="longest-days"
          label="Período"
          value={days}
          options={PERIOD_DAYS_OPTIONS}
          unit="dias"
          onChange={setDays}
        />
      </ReportFilters>
      <ReportTable
        columns={['#', 'Preso', 'Tempo fora da cela', 'Situação']}
        rows={rows}
        isLoading={query.isLoading}
        emptyMessage="Nenhuma saída temporária no período."
      />
      <PaginationBar
        page={page}
        pageSize={REPORT_PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
