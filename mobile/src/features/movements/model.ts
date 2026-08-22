import type { MovementType } from './types';

/**
 * Regras/derivações do domínio "movimentação" — funções puras, sem React nem
 * chamada de rede (research.md #32).
 */

export function filterTemporaryMovementTypes(types: MovementType[]): MovementType[] {
  return types.filter((type) => type.category === 'TEMPORARY');
}

export function canSubmitExitMovement(
  movementTypeId: number | null,
  destinationLocation: string,
): boolean {
  return movementTypeId !== null && destinationLocation.trim() !== '';
}
