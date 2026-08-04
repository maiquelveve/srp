import { ForbiddenException } from '@nestjs/common';

/**
 * Asserts every `targetUnitIds` entry is within `userUnitIds` (FR-004a).
 * Used by services validating body-level unit references (e.g. `POST /users`
 * `unitIds`) that a route-param guard like UnitScopeGuard cannot see.
 */
export function assertUnitScope(userUnitIds: number[], targetUnitIds: number[]): void {
  const outOfScope = targetUnitIds.filter((id) => !userUnitIds.includes(id));
  if (outOfScope.length > 0) {
    throw new ForbiddenException('Fora do escopo de unidade do usuário');
  }
}
