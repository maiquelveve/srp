import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api';
import { formatDateTime } from '../../format';
import { CELL_HISTORY_REASON_LABEL } from '../../labels';
import { useGalleryCells } from '../../hooks/useGalleryCells';
import { REPORT_PAGE_SIZE, usePagedState } from '../../hooks/usePagedState';
import { useNotifyOnError } from '../../hooks/useReportQuery';
import { REPORT_HELP } from '../../helpContent';
import PaginationBar from '../PaginationBar';
import ReportFilters from '../ReportFilters';
import ReportTable from '../ReportTable';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Histórico de ocupação de uma cela (FR-025): quem ocupou, de quando a quando e por que saiu. */
export default function CellOccupancyTab({ unitId }: { unitId: number | null }): JSX.Element {
  const { galleryId, setGalleryId, galleries, cells } = useGalleryCells(unitId);
  const [cellId, setCellId] = useState<number | null>(null);
  const [page, setPage] = usePagedState(`${cellId}`);

  // Seleciona a primeira cela da galeria assim que ela carrega, e de novo ao trocar de galeria.
  useEffect(() => {
    if (cells.length === 0) {
      setCellId(null);
      return;
    }
    if (cellId === null || !cells.some((cell) => cell.id === cellId)) {
      setCellId(cells[0].id);
    }
  }, [cells, cellId]);

  const query = useQuery({
    queryKey: ['report', 'cell-occupancy-history', cellId, page],
    queryFn: () =>
      reportsApi.cellOccupancyHistory({
        cellId: cellId as number,
        limit: REPORT_PAGE_SIZE,
        offset: page * REPORT_PAGE_SIZE,
      }),
    enabled: cellId !== null,
    placeholderData: keepPreviousData,
  });
  useNotifyOnError(query.isError, 'Histórico de ocupação');

  const rows = (query.data?.data ?? []).map((entry) => [
    <span key="name" className="uppercase">
      {entry.inmateName}
    </span>,
    formatDateTime(entry.entryDate),
    entry.exitDate ? formatDateTime(entry.exitDate) : <Badge variant="success">Ocupa agora</Badge>,
    entry.reason ? CELL_HISTORY_REASON_LABEL[entry.reason] : '-',
  ]);

  return (
    <div className="space-y-4">
      <ReportFilters help={REPORT_HELP.occupancy}>
        <div className="grid min-w-[160px] gap-1.5">
          <Label htmlFor="occupancy-gallery">Galeria</Label>
          <Select
            value={galleryId ? String(galleryId) : ''}
            onValueChange={(value) => setGalleryId(Number(value))}
          >
            <SelectTrigger id="occupancy-gallery">
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
        <div className="grid min-w-[160px] gap-1.5">
          <Label htmlFor="occupancy-cell">Cela</Label>
          <Select
            value={cellId ? String(cellId) : ''}
            onValueChange={(value) => setCellId(Number(value))}
          >
            <SelectTrigger id="occupancy-cell">
              <SelectValue placeholder="Selecione a cela" />
            </SelectTrigger>
            <SelectContent>
              {cells.map((cell) => (
                <SelectItem key={cell.id} value={String(cell.id)}>
                  {cell.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ReportFilters>

      {cellId === null ? (
        <p className="text-sm text-muted-foreground">Selecione uma cela para ver o histórico.</p>
      ) : (
        <>
          <ReportTable
            columns={['Preso', 'Entrada', 'Saída', 'Motivo da saída']}
            rows={rows}
            isLoading={query.isLoading}
            emptyMessage="Nenhum registro de ocupação."
          />
          <PaginationBar
            page={page}
            pageSize={REPORT_PAGE_SIZE}
            total={query.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
