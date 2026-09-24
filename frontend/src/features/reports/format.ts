const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : '-';
}

/** `2026-08-01` -> `01/08/2026`, sem passar por `Date` (evita deslocar o dia por fuso). */
export function formatIsoDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function formatHours(hours: number): string {
  return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}
