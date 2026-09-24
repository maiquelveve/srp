/**
 * Destaque da data da escala, logo abaixo do título do modal: "folha de calendário"
 * (mês, dia grande) ao lado do dia da semana e da data completa. Segue o padrão do
 * `RoutineHeaderCard`: borda `border-primary` e rótulo em uppercase/`text-primary`.
 */
export default function DateHighlight({ isoDate }: { isoDate: string }): JSX.Element {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const monthShort = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const fullDate = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary bg-card p-3">
      <div className="flex size-14 shrink-0 flex-col overflow-hidden rounded-lg border border-primary/30 bg-accent text-center">
        <span className="bg-primary py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
          {monthShort}
        </span>
        <span className="flex flex-1 items-center justify-center text-2xl font-bold leading-none text-primary">
          {String(day).padStart(2, '0')}
        </span>
      </div>
      <div className="grid gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-primary">
          Data da escala
        </span>
        <span className="text-base font-semibold capitalize text-foreground">{weekday}</span>
        <span className="text-sm text-muted-foreground">{fullDate}</span>
      </div>
    </div>
  );
}
