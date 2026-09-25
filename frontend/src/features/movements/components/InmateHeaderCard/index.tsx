import { UserIcon } from 'lucide-react';

/**
 * Destaque do preso sobre o qual o modal age, logo abaixo do `DialogTitle`
 * (movimentação, situação definitiva, troca/permuta, reversão). Mesmo padrão do
 * `RoutineHeaderCard` e do `DateHighlight`: borda `border-primary`, ícone num
 * quadrado `bg-accent`/`text-primary` e rótulo em uppercase acima do valor.
 * O nome do preso é sempre exibido em maiúsculo.
 */
export default function InmateHeaderCard({
  name,
  registrationId,
}: {
  name: string;
  registrationId?: string | null;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary bg-card p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
        <UserIcon className="size-5" />
      </div>
      <div className="grid min-w-0 gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-primary">Preso</span>
        <span className="truncate text-sm font-semibold uppercase text-foreground">{name}</span>
        {registrationId && (
          <span className="text-xs text-muted-foreground">Matrícula {registrationId}</span>
        )}
      </div>
    </div>
  );
}
