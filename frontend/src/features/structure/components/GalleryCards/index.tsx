import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshCcw,
  type LucideIcon,
} from 'lucide-react';
import { structureApi } from '../../api';
import type { Gallery } from '../../types';
import InmateDialog from '../InmateDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface GalleryCardsProps {
  galleries: Gallery[];
  galleryIds: number[];
  isWarden: boolean;
}

// Shared column template so the header row and every cell row line up —
// every column (Cela/Ocupação/Vagas/Status) is centered, title and data alike.
// The last column is a FIXED width (not `auto`) on purpose — each row is its
// own grid instance, so an `auto` track would size itself to that row's own
// badge text ("OK" vs "Quase cheia"), shifting the middle columns out of
// alignment from row to row and from the header.
const CELL_ROW_GRID = 'grid grid-cols-[20px_2.5rem_1fr_1fr_7.5rem] items-center gap-2';

// No Regime column here on purpose — a preso listado numa cela é, por
// definição, regime fechado; quem passa pra semiaberto/aberto/tornozeleira
// sai da cela (abre vaga), então mostrar Regime aqui só repetiria a mesma
// informação sempre. Same reasoning kills the Status column too — só preso
// ATIVO aparece numa cela (todo outro status tira o preso dela), então o
// espaço vira dois botões de ação (mover/alterar status) em vez de repetir
// "Ativo" em toda linha.
const INMATE_ROW_GRID = 'grid grid-cols-[1fr_1fr_4.5rem] items-center gap-2';

/**
 * Botão só-ícone sem ação ainda (mover preso / alterar status — depende de
 * telas de movimentação que ainda não existem); usa o `Button` do design
 * system (não um `<button>` cru) pra parecer um botão de verdade — borda
 * visível e o efeito de clique padrão (`active:scale-95`, research.md #20)
 * que todo `Button` já ganha automaticamente. Hover em amarelo (`primary`),
 * não o cinza padrão do `outline` — a linha inteira também fica cinza no
 * hover (`hover:bg-accent`), então um botão cinza-no-cinza some visualmente
 * quando o mouse passa por cima dele. `stopPropagation` evita que o clique
 * "vaze" pro `InmateDialog` (modo edição) que envolve a linha inteira.
 */
function InmateActionButton({ label, icon: Icon }: { label: string; icon: LucideIcon }): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 hover:border-primary hover:bg-primary hover:text-primary-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className="size-3.5" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CellRowInmates({
  cellId,
  cellLabel,
  isWarden,
  isFull,
}: {
  cellId: number;
  cellLabel: string;
  isWarden: boolean;
  isFull: boolean;
}): JSX.Element {
  const inmatesQuery = useQuery({
    queryKey: ['inmates', cellId],
    queryFn: () => structureApi.listInmates({ cellId }),
  });

  const inmates = inmatesQuery.data?.data ?? [];

  return (
    <div className="space-y-1 py-1">
      {inmatesQuery.isLoading && <p className="py-1 text-sm text-muted-foreground">Carregando presos...</p>}

      {!inmatesQuery.isLoading && inmates.length === 0 && (
        <p className="py-1 text-sm text-muted-foreground">Nenhum preso nesta cela.</p>
      )}

      {!inmatesQuery.isLoading && inmates.length > 0 && (
        <>
          <div className={cn(INMATE_ROW_GRID, 'px-2.5 text-xs font-medium text-muted-foreground')}>
            <span>Nome</span>
            <span className="text-center">Matrícula</span>
            <span className="text-center">Ações</span>
          </div>
          {inmates.map((inmate) => {
            const row = (
              <div
                className={cn(
                  INMATE_ROW_GRID,
                  'rounded-md border border-border bg-background px-2.5 py-1.5 text-sm',
                  isWarden && 'cursor-pointer transition-colors hover:bg-accent',
                )}
              >
                <span className="truncate">
                  {inmate.name}
                  {inmate.inMovement && <span className="ml-1.5 text-xs text-warning">(fora da cela)</span>}
                </span>
                <span className="truncate text-center text-muted-foreground">{inmate.registrationId ?? '—'}</span>
                <span className="flex items-center justify-center gap-1">
                  {isWarden && (
                    <>
                      <InmateActionButton label="Mover preso" icon={ArrowLeftRight} />
                      <InmateActionButton label="Alterar situação" icon={RefreshCcw} />
                    </>
                  )}
                </span>
              </div>
            );

            return isWarden ? (
              <InmateDialog key={inmate.id} inmate={inmate} cellId={cellId} cellLabel={cellLabel}>
                {row}
              </InmateDialog>
            ) : (
              <div key={inmate.id}>{row}</div>
            );
          })}
        </>
      )}

      {isWarden && (
        <div className="flex justify-end pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              {/* `disabled` alone already blocks the click from reaching
                  DialogTrigger's asChild-cloned handler — no need to skip
                  rendering InmateDialog itself when the cell is full. */}
              <span className={isFull ? 'cursor-not-allowed' : undefined}>
                <InmateDialog cellId={cellId} cellLabel={cellLabel}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isFull}
                    className="h-6 gap-1 border-primary bg-accent px-2 text-xs font-bold text-accent-foreground hover:scale-105"
                  >
                    <PlusIcon className="size-3" />
                    Cadastrar preso
                  </Button>
                </InmateDialog>
              </span>
            </TooltipTrigger>
            {isFull && <TooltipContent>Cela sem vagas</TooltipContent>}
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function GalleryCard({ gallery, isWarden }: { gallery: Gallery; isWarden: boolean }): JSX.Element {
  const [expandedCellId, setExpandedCellId] = useState<number | null>(null);
  const cellsQuery = useQuery({
    queryKey: ['cells', gallery.id],
    queryFn: () => structureApi.listCells(gallery.id),
  });

  const cells = cellsQuery.data?.data ?? [];
  const totalCapacity = cells.reduce((sum, cell) => sum + cell.capacity, 0);
  const totalOccupancy = cells.reduce((sum, cell) => sum + cell.occupancy, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Galeria {gallery.code}</CardTitle>
        <span className="text-sm text-muted-foreground">
          {totalOccupancy}/{totalCapacity} ocupados
        </span>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {cellsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando celas...</p>}
        {!cellsQuery.isLoading && cells.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma cela cadastrada.</p>
        )}
        {cells.length > 0 && (
          <div
            className={cn(CELL_ROW_GRID, 'border-b border-border px-2 pb-1.5 text-xs font-medium text-muted-foreground')}
          >
            <span />
            <span className="text-center">Cela</span>
            <span className="text-center">Ocupação</span>
            <span className="text-center">Vagas</span>
            <span className="text-center">Status</span>
          </div>
        )}
        {cells.map((cell) => {
          const isExpanded = expandedCellId === cell.id;
          const vacancies = cell.capacity - cell.occupancy;
          // Sem vaga (vermelho) = lotada de verdade, não "quase". "Quase
          // cheia" (âmbar) é só pra quem ainda tem 1+ vaga mas já passou de
          // 75% de ocupação — abaixo disso é OK (verde).
          const isFull = vacancies <= 0;
          const isAlmostFull = !isFull && cell.capacity > 0 && cell.occupancy / cell.capacity >= 0.75;
          const cellStatusVariant = isFull ? 'destructive' : isAlmostFull ? 'warning' : 'success';
          const cellStatusLabel = isFull ? 'Sem vagas' : isAlmostFull ? 'Quase cheia' : 'OK';
          return (
            <div key={cell.id}>
              <button
                type="button"
                onClick={() => setExpandedCellId(isExpanded ? null : cell.id)}
                className={cn(CELL_ROW_GRID, 'w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent')}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-center font-medium">{cell.code}</span>
                <span className="text-center text-muted-foreground">
                  {cell.occupancy}/{cell.capacity}
                </span>
                <span className="text-center text-muted-foreground">{vacancies}</span>
                <Badge variant={cellStatusVariant} className="justify-self-center whitespace-nowrap uppercase">
                  {cellStatusLabel}
                </Badge>
              </button>
              {isExpanded && (
                <div className="mb-3 ml-10 mr-16">
                  <CellRowInmates
                    cellId={cell.id}
                    cellLabel={`Galeria ${gallery.code} - Cela ${cell.code}`}
                    isWarden={isWarden}
                    isFull={isFull}
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Grid of one card per selected Galeria (aggregate ocupação no topo), com as
 * Celas listadas dentro em formato compacto — clicar numa Cela expande pra
 * mostrar os presos dela. Presos ganham cabeçalho de coluna igual às celas;
 * WARDEN pode clicar num preso pra editar seus dados cadastrais.
 */
export default function GalleryCards({ galleries, galleryIds, isWarden }: GalleryCardsProps): JSX.Element {
  const selectedGalleries = galleries.filter((gallery) => galleryIds.includes(gallery.id));

  if (galleryIds.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
        Selecione ao menos uma galeria e clique em Pesquisar.
      </div>
    );
  }

  if (selectedGalleries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
        Nenhuma galeria encontrada para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {selectedGalleries.map((gallery) => (
        <GalleryCard key={gallery.id} gallery={gallery} isWarden={isWarden} />
      ))}
    </div>
  );
}
