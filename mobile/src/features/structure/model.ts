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

export function inmateStatusLine(inmate: Inmate): string {
  if (!inmate.inMovement) return inmate.status;
  return `${inmate.status} — fora da cela (${inmate.currentMovement?.movementTypeName ?? '—'})`;
}

export function inmateMovementActionLabel(inmate: Inmate): 'Retorno' | 'Saída' {
  return inmate.inMovement ? 'Retorno' : 'Saída';
}
