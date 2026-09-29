import type { PendingMovement, PendingReturn } from '@/offline/offline-queue';
import type { Inmate, Unit } from './types';

/**
 * Regras/derivações do domínio "estrutura" — funções puras, sem React nem
 * chamada de rede, testáveis isoladas do ViewModel de qualquer tela
 * (research.md #32).
 */

export function findUnitById(units: Unit[], unitId: number | null): Unit | null {
  return units.find((unit) => unit.id === unitId) ?? null;
}

export function filterUnitsByIds(units: Unit[], ids: number[]): Unit[] {
  return units.filter((unit) => ids.includes(unit.id));
}

export function filterUnitsBySearch(units: Unit[], search: string): Unit[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return units;
  return units.filter(
    (unit) =>
      unit.name.toLowerCase().includes(normalizedSearch) ||
      (unit.code?.toLowerCase().includes(normalizedSearch) ?? false),
  );
}

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Busca por substring simples (não fuzzy), ignorando acentos — mesmo critério de `filterMovementTypesBySearch`. */
export function filterInmatesBySearch(inmates: Inmate[], search: string): Inmate[] {
  const normalizedSearch = normalizeForSearch(search.trim());
  if (!normalizedSearch) return inmates;
  return inmates.filter((inmate) => normalizeForSearch(inmate.name).includes(normalizedSearch));
}

export function inmateStatusLine(inmate: Inmate): string {
  if (!inmate.inMovement) return 'Na cela';
  return `Fora da cela: ${inmate.currentMovement?.movementTypeName ?? 'movimentação'}`;
}

/** Backend expõe status em inglês (ex.: "ACTIVE") — traduzimos os valores conhecidos pra exibição. */
export function inmateStatusLabel(status: string): string {
  if (status === 'ACTIVE') return 'Preso';
  return status;
}

export function inmateMovementActionLabel(inmate: Inmate): 'Retorno' | 'Saída' {
  return inmate.inMovement ? 'Retorno' : 'Saída';
}

export function isExternalMovementType(movementTypeName: string): boolean {
  return movementTypeName.toLowerCase().includes('extern');
}

export function movementTimeLabel(exitDateTime: string, now: Date = new Date()): string {
  const exit = new Date(exitDateTime);
  const isToday = exit.toDateString() === now.toDateString();
  const time = exit.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje, ${time}`;
  return `${exit.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`;
}

export function occupancyPercentage(capacity: number, occupancy: number): number {
  return capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;
}

export function pendingSyncLabel(count: number): string {
  const noun = count === 1 ? 'movimentação' : 'movimentações';
  const adjective = count === 1 ? 'pendente' : 'pendentes';
  return `${count} ${noun} ${adjective} de sincronização`;
}

/** "1 movimentação sincronizada" / "3 movimentações sincronizadas" — mesmo padrão de `pendingSyncLabel`, reaproveitado no toast do botão "Sincronizar agora". */
export function countedMovementsLabel(count: number, singularAdjective: string, pluralAdjective: string): string {
  const noun = count === 1 ? 'movimentação' : 'movimentações';
  const adjective = count === 1 ? singularAdjective : pluralAdjective;
  return `${count} ${noun} ${adjective}`;
}

export type InmatePendingStatus =
  | { kind: 'none' }
  | { kind: 'pending' }
  | { kind: 'rejected'; reason: string };

/**
 * Situação do preso na fila offline (T131, research.md #55): "pending"
 * enquanto aguarda sincronizar, "rejected" quando o servidor já recusou (com
 * o motivo, T129) — o card do preso usa isso pro selo, e o banner da tela
 * pra listar os motivos. `enqueueMovement`/`enqueueReturn` já garantem no
 * máximo um item pendente por preso/movimentação, então o primeiro achado
 * já é o único.
 */
export function inmatePendingStatus(
  inmate: Inmate,
  pendingMovements: PendingMovement[],
  pendingReturns: PendingReturn[],
): InmatePendingStatus {
  const pendingMovement = pendingMovements.find((movement) => movement.payload.inmateId === inmate.id);
  if (pendingMovement) {
    return pendingMovement.rejectionReason
      ? { kind: 'rejected', reason: pendingMovement.rejectionReason }
      : { kind: 'pending' };
  }

  const movementId = inmate.currentMovement?.movementId;
  const pendingReturn =
    movementId !== undefined ? pendingReturns.find((item) => item.movementId === movementId) : undefined;
  if (pendingReturn) {
    return pendingReturn.rejectionReason
      ? { kind: 'rejected', reason: pendingReturn.rejectionReason }
      : { kind: 'pending' };
  }

  return { kind: 'none' };
}
