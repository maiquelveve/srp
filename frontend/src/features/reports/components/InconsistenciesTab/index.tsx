import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api';
import { formatDateTime, formatIsoDate } from '../../format';
import { REPORT_HELP } from '../../helpContent';
import { REPORT_PAGE_SIZE, usePagedState } from '../../hooks/usePagedState';
import { useNotifyOnError } from '../../hooks/useReportQuery';
import PaginationBar from '../PaginationBar';
import PeriodSelect from '../PeriodSelect';
import ReportFilters from '../ReportFilters';
import ReportTable from '../ReportTable';
import { Badge } from '@/components/ui/badge';

const THRESHOLD_HOURS_OPTIONS = [1, 6, 12, 24, 48, 72];

/**
 * Inconsistências (FR-025, SC-005): saídas temporárias sem retorno além do
 * prazo e presos fora da cela sem motivo, cada lista com a sua paginação.
 * "Rotinas não executadas" são as que o Supervisor desativou para uma data
 * dos últimos 7 dias: o sistema não registra a execução de rotinas coletivas.
 */
export default function InconsistenciesTab({ unitId }: { unitId: number | null }): JSX.Element {
  const [thresholdHours, setThresholdHours] = useState(24);
  const filterKey = `${unitId}|${thresholdHours}`;
  const [returnPage, setReturnPage] = usePagedState(filterKey);
  const [reasonPage, setReasonPage] = usePagedState(filterKey);
  const [notExecutedPage, setNotExecutedPage] = usePagedState(filterKey);

  const query = useQuery({
    queryKey: [
      'report',
      'inconsistencies',
      unitId,
      thresholdHours,
      returnPage,
      reasonPage,
      notExecutedPage,
    ],
    queryFn: () =>
      reportsApi.inconsistencies({
        unitId: unitId as number,
        thresholdHours,
        limit: REPORT_PAGE_SIZE,
        withoutReturnOffset: returnPage * REPORT_PAGE_SIZE,
        withoutReasonOffset: reasonPage * REPORT_PAGE_SIZE,
        notExecutedOffset: notExecutedPage * REPORT_PAGE_SIZE,
      }),
    enabled: unitId !== null,
    placeholderData: keepPreviousData,
  });
  useNotifyOnError(query.isError, 'Inconsistências');

  const withoutReturnRows = (query.data?.movementsWithoutReturn ?? []).map((item) => [
    <span key="name" className="uppercase">
      {item.inmateName}
    </span>,
    formatDateTime(item.exitDateTime),
    <Badge key="hours" variant="destructive">
      {item.hoursOpen} h sem retorno
    </Badge>,
  ]);
  const withoutReasonRows = (query.data?.inmatesOutWithoutReason ?? []).map((item) => [
    <span key="name" className="uppercase">
      {item.inmateName}
    </span>,
    item.destinationLocation,
    formatDateTime(item.exitDateTime),
  ]);

  const notExecutedRows = (query.data?.routinesNotExecuted ?? []).map((item) => [
    item.routineName,
    item.galleryCode,
    formatIsoDate(item.date),
  ]);

  return (
    <div className="space-y-6">
      <ReportFilters help={REPORT_HELP.inconsistencies}>
        <PeriodSelect
          id="inconsistencies-threshold"
          label="Prazo esperado de retorno"
          value={thresholdHours}
          options={THRESHOLD_HOURS_OPTIONS}
          unit="horas"
          onChange={setThresholdHours}
        />
      </ReportFilters>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saídas sem retorno</h2>
        <ReportTable
          columns={['Preso', 'Saída', 'Situação']}
          rows={withoutReturnRows}
          isLoading={query.isLoading}
          emptyMessage="Nenhuma saída além do prazo."
        />
        <PaginationBar
          page={returnPage}
          pageSize={REPORT_PAGE_SIZE}
          total={query.data?.movementsWithoutReturnTotal ?? 0}
          onPageChange={setReturnPage}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Fora da cela sem motivo</h2>
        <ReportTable
          columns={['Preso', 'Destino', 'Saída']}
          rows={withoutReasonRows}
          isLoading={query.isLoading}
          emptyMessage="Nenhum preso fora da cela sem motivo."
        />
        <PaginationBar
          page={reasonPage}
          pageSize={REPORT_PAGE_SIZE}
          total={query.data?.inmatesOutWithoutReasonTotal ?? 0}
          onPageChange={setReasonPage}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Rotinas não executadas</h2>
        <ReportTable
          columns={['Rotina', 'Galeria', 'Data']}
          rows={notExecutedRows}
          isLoading={query.isLoading}
          emptyMessage="Nenhuma rotina desativada nos últimos 7 dias."
        />
        <PaginationBar
          page={notExecutedPage}
          pageSize={REPORT_PAGE_SIZE}
          total={query.data?.routinesNotExecutedTotal ?? 0}
          onPageChange={setNotExecutedPage}
        />
      </section>
    </div>
  );
}
