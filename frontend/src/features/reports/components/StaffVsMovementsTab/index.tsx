import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api';
import { useNotifyOnError } from '../../hooks/useReportQuery';
import { REPORT_HELP } from '../../helpContent';
import ReportFilters from '../ReportFilters';
import ReportTable from '../ReportTable';
import { SHIFT_LABEL } from '@/features/staff/labels';
import { todayIsoDate } from '@/features/staff/date';
import DatePicker from '@/features/routines/components/DatePicker';
import { Label } from '@/components/ui/label';

/** Efetivo escalado versus movimentações registradas por turno (FR-025). Diurno: 07h às 19h. */
export default function StaffVsMovementsTab({ unitId }: { unitId: number | null }): JSX.Element {
  const [date, setDate] = useState(todayIsoDate());
  const query = useQuery({
    queryKey: ['report', 'staff-vs-movements', unitId, date],
    queryFn: () => reportsApi.staffVsMovements({ unitId: unitId as number, date }),
    enabled: unitId !== null,
  });
  useNotifyOnError(query.isError, 'Efetivo e movimentações');

  const rows = (query.data?.data ?? []).map((item) => [
    SHIFT_LABEL[item.shift],
    item.scheduledOfficers,
    item.presentOfficers,
    item.absentOfficers,
    item.movementCount,
    item.movementsPerPresentOfficer === null
      ? '-'
      : item.movementsPerPresentOfficer.toLocaleString('pt-BR'),
  ]);

  return (
    <div className="space-y-4">
      <ReportFilters help={REPORT_HELP.staff}>
        <div className="grid gap-1.5">
          <Label htmlFor="staff-report-date">Data</Label>
          <DatePicker id="staff-report-date" value={date} onChange={setDate} className="w-40" />
        </div>
      </ReportFilters>
      <ReportTable
        columns={[
          'Turno',
          'Escalados',
          'Presentes',
          'Faltas',
          'Movimentações',
          'Por policial presente',
        ]}
        rows={rows}
        isLoading={query.isLoading}
        emptyMessage="Sem dados para a data."
      />
    </div>
  );
}
