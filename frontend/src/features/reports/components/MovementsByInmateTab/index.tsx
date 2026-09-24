import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api';
import { formatDateTime } from '../../format';
import { PERIOD_DAYS_OPTIONS } from '../../labels';
import { useGalleryCells } from '../../hooks/useGalleryCells';
import { REPORT_PAGE_SIZE, usePagedState } from '../../hooks/usePagedState';
import { useNotifyOnError } from '../../hooks/useReportQuery';
import { REPORT_HELP } from '../../helpContent';
import PaginationBar from '../PaginationBar';
import PeriodSelect from '../PeriodSelect';
import ReportFilters from '../ReportFilters';
import ReportTable from '../ReportTable';
import { structureApi } from '@/features/structure/api';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Movimentações de um preso no período (FR-025). O preso é escolhido a partir de uma galeria da unidade. */
export default function MovementsByInmateTab({ unitId }: { unitId: number | null }): JSX.Element {
  const { galleryId, setGalleryId, galleries } = useGalleryCells(unitId);
  const [inmateId, setInmateId] = useState<number | null>(null);
  const [days, setDays] = useState(30);
  const [page, setPage] = usePagedState(`${inmateId}|${days}`);

  const inmatesQuery = useQuery({
    queryKey: ['inmates', 'gallery', galleryId],
    queryFn: () => structureApi.listInmates({ galleryId: galleryId as number }),
    enabled: galleryId !== null,
  });
  const inmates = inmatesQuery.data?.data ?? [];

  useEffect(() => {
    setInmateId(null);
  }, [galleryId]);

  const reportQuery = useQuery({
    queryKey: ['report', 'movements-by-inmate', inmateId, days, page],
    queryFn: () =>
      reportsApi.movementsByInmate(inmateId as number, {
        days,
        limit: REPORT_PAGE_SIZE,
        offset: page * REPORT_PAGE_SIZE,
      }),
    enabled: inmateId !== null,
    placeholderData: keepPreviousData,
  });
  useNotifyOnError(reportQuery.isError, 'Movimentações do preso');

  const rows = (reportQuery.data?.data ?? []).map((movement) => [
    formatDateTime(movement.exitDateTime),
    movement.movementTypeName,
    movement.destinationLocation,
    movement.reason ?? '-',
    movement.returnDateTime ? (
      formatDateTime(movement.returnDateTime)
    ) : movement.category === 'TEMPORARY' ? (
      <Badge variant="warning">Sem retorno</Badge>
    ) : (
      '-'
    ),
    movement.registeredByName,
  ]);

  return (
    <div className="space-y-4">
      <ReportFilters help={REPORT_HELP.byInmate}>
        <div className="grid min-w-[160px] gap-1.5">
          <Label htmlFor="movements-gallery">Galeria</Label>
          <Select
            value={galleryId ? String(galleryId) : ''}
            onValueChange={(value) => setGalleryId(Number(value))}
          >
            <SelectTrigger id="movements-gallery">
              <SelectValue placeholder="Selecione a galeria" />
            </SelectTrigger>
            <SelectContent>
              {galleries.map((gallery) => (
                <SelectItem key={gallery.id} value={String(gallery.id)}>
                  {gallery.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-[240px] flex-1 gap-1.5">
          <Label htmlFor="movements-inmate">Preso</Label>
          <Select
            value={inmateId ? String(inmateId) : ''}
            onValueChange={(value) => setInmateId(Number(value))}
          >
            <SelectTrigger id="movements-inmate" className="uppercase">
              <SelectValue placeholder="Selecione o preso" />
            </SelectTrigger>
            <SelectContent>
              {inmates.map((inmate) => (
                <SelectItem key={inmate.id} value={String(inmate.id)} className="uppercase">
                  {inmate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PeriodSelect
          id="movements-days"
          label="Período"
          value={days}
          options={PERIOD_DAYS_OPTIONS}
          unit="dias"
          onChange={setDays}
        />
      </ReportFilters>

      {inmateId === null ? (
        <p className="text-sm text-muted-foreground">
          Selecione um preso para ver as movimentações.
        </p>
      ) : (
        <>
          <ReportTable
            columns={['Saída', 'Tipo', 'Destino', 'Motivo', 'Retorno', 'Registrado por']}
            rows={rows}
            isLoading={reportQuery.isLoading}
            emptyMessage="Nenhuma movimentação no período."
          />
          <PaginationBar
            page={page}
            pageSize={REPORT_PAGE_SIZE}
            total={reportQuery.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
