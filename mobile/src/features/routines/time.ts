/** Descarta segundos vindos do backend (`HH:mm:ss`, round-trip da coluna TIME do Postgres) — a UI nunca exibe segundos. Mesma regra de frontend/src/features/routines/time.ts. */
export function toHHMM(time: string): string {
  return time.slice(0, 5);
}
