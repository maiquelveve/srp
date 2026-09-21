import { CalendarClockIcon } from 'lucide-react';

/**
 * Destaque da Rotina sendo editada, logo abaixo do `DialogTitle` em
 * `ScheduleDialog`/`ActivationDialog` — substitui o antigo `DialogDescription`
 * em texto simples (feedback do usuário: o nome da rotina ficava sem
 * destaque nenhum). Mesmo ícone usado no item "Rotinas" do menu lateral
 * (`AppShell`), reforçando de qual entidade se trata.
 */
export default function RoutineHeaderCard({ name }: { name: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary bg-card p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
        <CalendarClockIcon className="size-5" />
      </div>
      <div className="grid gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-primary">Rotina</span>
        <span className="text-sm font-semibold text-foreground">{name}</span>
      </div>
    </div>
  );
}
