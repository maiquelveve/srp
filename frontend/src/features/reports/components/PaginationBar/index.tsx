import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Rodapé de paginação: total à esquerda e, havendo mais de uma página, Anterior/Próxima à direita. */
export default function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationBarProps): JSX.Element {
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? 'registro' : 'registros'}
      </p>
      {lastPage > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeftIcon />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {lastPage + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
