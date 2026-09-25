import { forwardRef, useState, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshCcw,
  Shuffle,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react';
import { structureApi } from '../../api';
import type { Gallery } from '../../types';
import InmateDialog from '../InmateDialog';
import DefinitiveSituations from '../DefinitiveSituations';
import MovementDialog from '../../../movements/components/MovementDialog';
import FinalSituationDialog from '../../../movements/components/FinalSituationDialog';
import CellTransferDialog from '../../../movements/components/CellTransferDialog';
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
// `minmax(0,1fr)` em vez de `1fr` cru — sem isso, o "automatic minimum size"
// de um grid item some (vira efetivamente 0px, texto inteiro invisível em
// vez de truncado com "...") quando a linha fica espremida demais pro
// conteúdo (containers estreitos, cards em duas colunas numa tela menor).
// `minmax(0, ...)` é a forma explícita e correta de dizer "essa coluna pode
// encolher até 0 sem carregar o min-content junto" (mesmo problema, mesma
// correção, em research.md #37).
const CELL_ROW_GRID = 'grid grid-cols-[20px_2.5rem_minmax(0,1fr)_minmax(0,1fr)_7.5rem] items-center gap-2';

// No Regime column here on purpose — a preso listado numa cela é, por
// definição, regime fechado; quem passa pra semiaberto/aberto/tornozeleira
// sai da cela (abre vaga), então mostrar Regime aqui só repetiria a mesma
// informação sempre. Same reasoning kills the Status column too — só preso
// ATIVO aparece numa cela (todo outro status tira o preso dela), então o
// espaço vira dois botões de ação (mover/alterar status) em vez de repetir
// "Ativo" em toda linha.
// Última coluna alargada pra caber até 3 botões de ação (Mover preso/Trocar
// de cela sempre; Alterar situação só pra WARDEN) sem apertar.
const INMATE_ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem] items-center gap-2';

/**
 * Botão só-ícone usado tanto solto (alterar situação, ainda sem ação — US3
 * não implementada) quanto como filho direto de `MovementDialog`'s
 * `DialogTrigger asChild` (mover preso) — por isso `forwardRef`, mesmo
 * motivo do `RowActionButton` em `/configuracoes` (tasks.md T034h): um
 * componente de função simples dispara o aviso do React de "Function
 * components cannot be given refs" quando usado como `asChild`. Usa o
 * `Button` do design system (não um `<button>` cru) pra parecer um botão de
 * verdade — borda visível e o efeito de clique padrão (`active:scale-95`,
 * research.md #20) que todo `Button` já ganha automaticamente. Hover em
 * amarelo (`primary`), não o cinza padrão do `outline` — a linha inteira
 * também fica cinza no hover (`hover:bg-accent`), então um botão
 * cinza-no-cinza some visualmente quando o mouse passa por cima dele.
 * `stopPropagation` evita que o clique "vaze" pro `InmateDialog` (modo
 * edição) que envolve a linha inteira.
 */
const InmateActionButton = forwardRef<
  HTMLButtonElement,
  { label: string; icon: LucideIcon; tooltip?: string } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ label, icon: Icon, tooltip, onClick, disabled, ...props }, ref) => (
  <Tooltip>
    {/* Mesmo motivo do "Cadastrar preso" abaixo: um `<button disabled>` não
        dispara os eventos de hover que o TooltipTrigger escuta em alguns
        navegadores, então o span (sempre "hoverable") é quem carrega o
        trigger — o botão desabilitado só decide o cursor/estilo. */}
    <TooltipTrigger asChild>
      <span className={disabled ? 'cursor-not-allowed' : undefined}>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          className="h-7 w-7 hover:border-primary hover:bg-primary hover:text-primary-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(e);
          }}
          {...props}
        >
          <Icon className="size-3.5" />
          <span className="sr-only">{label}</span>
        </Button>
      </span>
    </TooltipTrigger>
    <TooltipContent>{tooltip ?? label}</TooltipContent>
  </Tooltip>
));
InmateActionButton.displayName = 'InmateActionButton';

/**
 * O texto amarelo "(Tipo da movimentação)" ao lado do nome do preso — igual
 * ao `InmateActionButton`, precisa ser `forwardRef` pra funcionar como filho
 * direto de `MovementDialog`'s `DialogTrigger asChild` (mode="edit"). Clicar
 * abre a movimentação aberta pra edição, sem passar pelo `InmateDialog` (modo
 * edição de cadastro) que envolve a linha inteira — o `stopPropagation`
 * central que resolve isso já vive dentro do próprio `MovementDialog`.
 */
const MovementBadge = forwardRef<HTMLSpanElement, { label: string } & HTMLAttributes<HTMLSpanElement>>(
  ({ label, className, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          ref={ref}
          className={cn('ml-1.5 cursor-pointer text-xs text-warning hover:underline', className)}
          {...props}
        >
          ({label})
        </span>
      </TooltipTrigger>
      <TooltipContent>Clique para alterar/editar a movimentação</TooltipContent>
    </Tooltip>
  ),
);
MovementBadge.displayName = 'MovementBadge';

function CellRowInmates({
  cellId,
  cellLabel,
  currentGalleryId,
  isWarden,
  isFull,
  galleries,
}: {
  cellId: number;
  cellLabel: string;
  currentGalleryId: number;
  isWarden: boolean;
  isFull: boolean;
  galleries: Gallery[];
}): JSX.Element {
  // `status: 'ACTIVE'` é obrigatório aqui — sem ele a listagem traz também
  // presos com situação definitiva já registrada (liberado/tornozeleira/
  // transferido/óbito), que continuam com `currentCellId` apontando pra cá
  // (é o timeline de FR-016, research.md #9). Sem o filtro, a lista mostra
  // mais presos do que a ocupação real da cela (que já é ACTIVE-only, ver
  // `CellsService.occupancyOf`), dando a falsa impressão de que a contagem
  // de vagas está errada.
  const inmatesQuery = useQuery({
    queryKey: ['inmates', cellId],
    queryFn: () => structureApi.listInmates({ cellId, status: 'ACTIVE' }),
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
                <span className="truncate uppercase">
                  {inmate.name}
                  {inmate.inMovement && (
                    <MovementDialog inmate={inmate} cellId={cellId} mode="edit">
                      <MovementBadge label={inmate.currentMovement?.movementTypeName ?? 'fora da cela'} />
                    </MovementDialog>
                  )}
                </span>
                <span className="truncate text-center text-muted-foreground">{inmate.registrationId ?? '—'}</span>
                <span className="flex items-center justify-center gap-1">
                  {/* Mover preso é para qualquer autenticado (PRISON_OFFICER,
                      SUPERVISOR, WARDEN — contracts/movements.md), não só
                      WARDEN como o resto das ações desta linha. */}
                  <MovementDialog inmate={inmate} cellId={cellId}>
                    <InmateActionButton
                      label={inmate.inMovement ? 'Registrar retorno' : 'Mover preso'}
                      icon={inmate.inMovement ? Undo2Icon : ArrowLeftRight}
                    />
                  </MovementDialog>
                  {/* Troca/permuta de cela é para qualquer perfil (research.md
                      #35) — igual "Mover preso", não gated por isWarden.
                      Desabilitada enquanto o preso está fora da cela numa
                      movimentação temporária em aberto (o backend também
                      recusa isso, 409 — aqui é só a UI espelhando pra não
                      deixar preencher o formulário à toa). */}
                  <CellTransferDialog
                    inmate={inmate}
                    currentGalleryId={currentGalleryId}
                    galleries={galleries}
                  >
                    <InmateActionButton
                      label="Trocar de cela"
                      icon={Shuffle}
                      disabled={inmate.inMovement}
                      tooltip={
                        inmate.inMovement
                          ? 'Preso em movimentação temporária. Registre o retorno antes de continuar.'
                          : undefined
                      }
                    />
                  </CellTransferDialog>
                  {isWarden && (
                    <FinalSituationDialog inmate={inmate}>
                      <InmateActionButton
                        label="Alterar situação"
                        icon={RefreshCcw}
                        disabled={inmate.inMovement}
                        tooltip={
                          inmate.inMovement
                            ? 'Preso em movimentação temporária. Registre o retorno antes de continuar.'
                            : undefined
                        }
                      />
                    </FinalSituationDialog>
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

      {isWarden && <DefinitiveSituations cellId={cellId} galleries={galleries} />}

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

function GalleryCard({
  gallery,
  galleries,
  isWarden,
}: {
  gallery: Gallery;
  galleries: Gallery[];
  isWarden: boolean;
}): JSX.Element {
  const [expandedCellId, setExpandedCellId] = useState<number | null>(null);
  const cellsQuery = useQuery({
    queryKey: ['cells', gallery.id],
    queryFn: () => structureApi.listCells(gallery.id),
  });

  // Mapa da Unidade only shows operational celas — deactivated ones stay
  // visible (with a Reativar path) in /configuracoes, which is the cadastro/
  // management screen, but have no business appearing on the day-to-day
  // consulta view.
  const cells = (cellsQuery.data?.data ?? []).filter((cell) => cell.active);
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
                // `ml-10 mr-16` (research.md #37) era grande demais em telas
                // médias — combinado com o card ficando estreito em duas
                // colunas (ver `lg:grid-cols-2` abaixo), sobrava pouco pro
                // grid de 3 colunas da lista de presos, colapsando pra 0px
                // (nome do preso literalmente invisível, não só truncado).
                <div className="mb-3 ml-6 mr-6">
                  <CellRowInmates
                    cellId={cell.id}
                    cellLabel={`Galeria ${gallery.code} - Cela ${cell.code}`}
                    currentGalleryId={gallery.id}
                    isWarden={isWarden}
                    isFull={isFull}
                    galleries={galleries}
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
    // `lg:` (não `md:`) de propósito — duas colunas a partir de `md` (768px)
    // deixava cada card estreito demais pra caber o grid de 3 colunas da
    // lista de presos expandida (research.md #37); esperar `lg` (1024px)
    // dá espaço de sobra, e abaixo disso uma coluna só já usa a largura
    // inteira disponível.
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {selectedGalleries.map((gallery) => (
        // `galleries` aqui é a lista COMPLETA da unidade (não só as
        // selecionadas no filtro) — troca/permuta de galeria deve poder
        // escolher qualquer galeria da unidade como destino, não só as que
        // estão sendo exibidas no momento.
        <GalleryCard key={gallery.id} gallery={gallery} galleries={galleries} isWarden={isWarden} />
      ))}
    </div>
  );
}
