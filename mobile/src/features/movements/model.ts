import { Briefcase, Gavel, HeartPulse, Repeat } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { MovementType } from './types';

/**
 * Regras/derivações do domínio "movimentação" — funções puras, sem React nem
 * chamada de rede (research.md #32).
 */

export function filterTemporaryMovementTypes(types: MovementType[]): MovementType[] {
  return types.filter((type) => type.category === 'TEMPORARY');
}

export function filterMovementTypesBySearch(types: MovementType[], search: string): MovementType[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return types;
  return types.filter((type) => type.name.toLowerCase().includes(normalizedSearch));
}

/** Ícone só decorativo — a API não expõe ícone por tipo, então inferimos por palavra-chave do nome. */
export function movementTypeIcon(name: string): LucideIcon {
  const normalized = name.toLowerCase();
  if (normalized.includes('trabalho')) return Briefcase;
  if (normalized.includes('médic') || normalized.includes('medic') || normalized.includes('saúde'))
    return HeartPulse;
  if (normalized.includes('audiênc') || normalized.includes('audienc')) return Gavel;
  return Repeat;
}

export function canSubmitExitMovement(
  movementTypeId: number | null,
  destinationLocation: string,
): boolean {
  return movementTypeId !== null && destinationLocation.trim() !== '';
}
