import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon, ChevronRightIcon, Undo2Icon } from 'lucide-react';
import { structureApi } from '../../api';
import type { Gallery } from '../../types';
import StatusBadge from '../StatusBadge';
import ReversalDialog from '../../../movements/components/ReversalDialog';
import { Button } from '@/components/ui/button';

/**
 * Presos que saíram desta cela por liberdade, tornozeleira ou transferência
 * (só WARDEN). Ficam recolhidos por padrão e só são buscados ao abrir. É
 * daqui que a Chefia reverte uma situação registrada por engano (FR-016a).
 */
export default function DefinitiveSituations({
  cellId,
  galleries,
}: {
  cellId: number;
  galleries: Gallery[];
}): JSX.Element {
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ['inmates', cellId, 'definitive'],
    queryFn: () => structureApi.listInmates({ cellId }),
    enabled: open,
  });
  const inmates = (query.data?.data ?? []).filter((inmate) => inmate.status !== 'ACTIVE');

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
        Situações definitivas desta cela
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {query.isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
          {!query.isLoading && inmates.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum preso com situação definitiva nesta cela.</p>
          )}
          {inmates.map((inmate) => (
            <div
              key={inmate.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <span className="truncate uppercase">{inmate.name}</span>
              <span className="flex items-center gap-2">
                <StatusBadge status={inmate.status} />
                {inmate.status !== 'DECEASED' && (
                  <ReversalDialog inmate={inmate} galleries={galleries}>
                    <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
                      <Undo2Icon className="size-3" />
                      Reverter
                    </Button>
                  </ReversalDialog>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
