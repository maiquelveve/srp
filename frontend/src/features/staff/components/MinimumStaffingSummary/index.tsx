import {
  MoonIcon,
  SunIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  type LucideIcon,
} from 'lucide-react';
import { SHIFT_LABEL } from '../../labels';
import type { PostStaffing, PostShiftStaffing, Schedule, Shift } from '../../types';
import AttendanceDialog from '../AttendanceDialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const SHIFT_ICON: Record<Shift, LucideIcon> = { DAY: SunIcon, NIGHT: MoonIcon };
const SHIFTS: Shift[] = ['DAY', 'NIGHT'];

/** Cor do turno: ninguém no posto, abaixo do mínimo ou adequado (cinza sem mínimo configurado). */
function shiftTone(entry: PostShiftStaffing): 'destructive' | 'warning' | 'success' | 'muted' {
  if (entry.minimum === 0) return 'muted';
  if (entry.staffed === 0) return 'destructive';
  return entry.belowMinimum ? 'warning' : 'success';
}

const TONE_BAR: Record<ReturnType<typeof shiftTone>, string> = {
  destructive: 'bg-destructive',
  warning: 'bg-warning',
  success: 'bg-success',
  muted: 'bg-muted-foreground/40',
};

/** Cor da borda do card selecionado: ninguém no posto, abaixo do mínimo ou adequado. */
function selectedBorderClass(post: PostStaffing): string {
  if (post.shifts.every((entry) => entry.staffed === 0)) return 'border-destructive';
  return post.shifts.some((entry) => entry.belowMinimum) ? 'border-warning' : 'border-success';
}

/** Um turno do posto: número grande, barra de progresso até o mínimo e as faltas. */
function ShiftTile({ shift, entry }: { shift: Shift; entry?: PostShiftStaffing }): JSX.Element {
  const Icon = SHIFT_ICON[shift];
  const progress =
    entry && entry.minimum > 0 ? Math.min(100, (entry.staffed / entry.minimum) * 100) : 0;

  return (
    <div className="grid content-start gap-1.5 rounded-lg bg-muted/50 p-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {SHIFT_LABEL[shift]}
      </span>
      {entry ? (
        <>
          <span className="text-2xl font-semibold leading-none">
            {entry.staffed}
            {entry.minimum > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {' '}
                / {entry.minimum} mín.
              </span>
            )}
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', TONE_BAR[shiftTone(entry)])}
              style={{ width: `${progress}%` }}
            />
          </div>
          {entry.absent > 0 ? (
            <span className="flex w-fit items-center gap-1 text-xs font-medium text-destructive">
              <UserRoundXIcon className="size-3.5" />
              {entry.absent} {entry.absent === 1 ? 'falta' : 'faltas'}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {entry.minimum > 0 ? 'Sem faltas' : 'Sem mínimo'}
            </span>
          )}
        </>
      ) : (
        <span className="text-sm text-muted-foreground">Sem escala</span>
      )}
    </div>
  );
}

/**
 * Efetivo por posto (FR-024): um card por posto com Diurno e Noturno lado a lado. Sem borda
 * fixa: ao clicar, a borda mostra a situação (vermelha sem ninguém, amarela abaixo do mínimo,
 * verde adequado).
 */
export default function MinimumStaffingSummary({
  posts,
  schedules,
  selectedPostId,
  onSelect,
}: {
  posts: PostStaffing[];
  schedules: Schedule[];
  selectedPostId: number | null;
  onSelect: (postId: number | null) => void;
}): JSX.Element {
  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum posto com escala ou efetivo mínimo configurado neste dia.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => {
        const hasMinimum = post.shifts.some((entry) => entry.minimum > 0);
        const isBelowMinimum = post.shifts.some((entry) => entry.belowMinimum);
        const isSelected = post.postId === selectedPostId;
        const postSchedules = schedules.filter((schedule) => schedule.postId === post.postId);
        return (
          <Card
            key={post.postId}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? null : post.postId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(isSelected ? null : post.postId);
              }
            }}
            className={cn(
              'cursor-pointer border-2 border-transparent shadow-sm transition-shadow hover:shadow-md',
              isSelected && selectedBorderClass(post),
            )}
          >
            <CardContent className="grid gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold">{post.postName}</span>
                {/* Fora do clique do card: abrir a presença não seleciona o posto. */}
                {postSchedules.length > 0 && (
                  <span
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <AttendanceDialog postName={post.postName} schedules={postSchedules}>
                            <button
                              type="button"
                              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <UserRoundCheckIcon className="size-[18px]" />
                              <span className="sr-only">Registrar presença</span>
                            </button>
                          </AttendanceDialog>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Registrar presença</TooltipContent>
                    </Tooltip>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SHIFTS.map((shift) => (
                  <ShiftTile
                    key={shift}
                    shift={shift}
                    entry={post.shifts.find((entry) => entry.shift === shift)}
                  />
                ))}
              </div>

              {hasMinimum ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-fit">
                      <Badge variant={isBelowMinimum ? 'warning' : 'success'}>
                        {isBelowMinimum ? 'Abaixo do mínimo' : 'Efetivo adequado'}
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isBelowMinimum ? (
                      <ul className="grid gap-1">
                        {post.shifts
                          .filter((entry) => entry.belowMinimum)
                          .map((entry) => (
                            <li key={entry.shift}>
                              {SHIFT_LABEL[entry.shift]}: {entry.staffed} presente
                              {entry.staffed === 1 ? '' : 's'} para um mínimo de {entry.minimum}
                              {entry.absent > 0 &&
                                ` (${entry.absent} ${entry.absent === 1 ? 'falta' : 'faltas'} descontada${entry.absent === 1 ? '' : 's'})`}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      'Todos os turnos têm ao menos o efetivo mínimo.'
                    )}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Badge variant="secondary" className="w-fit">
                  Mínimo não configurado
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
