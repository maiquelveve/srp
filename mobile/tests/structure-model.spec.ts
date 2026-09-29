/**
 * mobile/src/features/structure/model.ts — `inmatePendingStatus` (T131,
 * research.md #55): selo "Pendente"/"Recusada" no card do preso, a partir do
 * que a fila offline já guarda. `inmateStatusLine` (T132): rótulo sem
 * travessão longo.
 */
import { inmatePendingStatus, inmateStatusLine } from '../src/features/structure/model';
import type { PendingMovement, PendingReturn } from '../src/offline/offline-queue';
import type { Inmate } from '../src/features/structure/types';

function makeInmate(overrides: Partial<Inmate> = {}): Inmate {
  return {
    id: 1,
    name: 'Fulano de Tal',
    status: 'ACTIVE',
    currentCellId: 10,
    inMovement: false,
    currentMovement: null,
    photoUrl: null,
    ...overrides,
  };
}

function makePendingMovement(overrides: Partial<PendingMovement> = {}): PendingMovement {
  return {
    id: 1,
    idempotencyKey: 'key-1',
    payload: {
      inmateId: 1,
      movementTypeId: 4,
      originCellId: 10,
      destinationLocation: 'Enfermaria',
      reason: 'Consulta',
    },
    createdAt: '2026-09-26T10:00:00.000Z',
    rejectionReason: null,
    ...overrides,
  };
}

function makePendingReturn(overrides: Partial<PendingReturn> = {}): PendingReturn {
  return {
    id: 1,
    idempotencyKey: 'key-2',
    movementId: 500,
    createdAt: '2026-09-26T10:00:00.000Z',
    rejectionReason: null,
    ...overrides,
  };
}

describe('inmateStatusLine (T132 — sem travessão longo)', () => {
  it('says the inmate is in the cell when there is no open movement', () => {
    expect(inmateStatusLine(makeInmate({ inMovement: false }))).toBe('Na cela');
  });

  it('names the movement type using a colon, never an em dash', () => {
    const inmate = makeInmate({
      inMovement: true,
      currentMovement: { movementId: 900, movementTypeName: 'Atendimento médico', exitDateTime: '2026-09-26T09:00:00.000Z' },
    });

    expect(inmateStatusLine(inmate)).toBe('Fora da cela: Atendimento médico');
    expect(inmateStatusLine(inmate)).not.toContain('—');
  });
});

describe('inmatePendingStatus (T131)', () => {
  it('is "none" when the inmate has no pending movement or return', () => {
    expect(inmatePendingStatus(makeInmate(), [], [])).toEqual({ kind: 'none' });
  });

  it('is "pending" when a movement is queued for this inmate and not yet rejected', () => {
    const inmate = makeInmate({ id: 16 });
    const pendingMovements = [makePendingMovement({ payload: { ...makePendingMovement().payload, inmateId: 16 } })];

    expect(inmatePendingStatus(inmate, pendingMovements, [])).toEqual({ kind: 'pending' });
  });

  it('is "rejected" with the server reason when the queued movement was rejected', () => {
    const inmate = makeInmate({ id: 16 });
    const pendingMovements = [
      makePendingMovement({
        payload: { ...makePendingMovement().payload, inmateId: 16 },
        rejectionReason: 'Preso já está em movimentação temporária.',
      }),
    ];

    expect(inmatePendingStatus(inmate, pendingMovements, [])).toEqual({
      kind: 'rejected',
      reason: 'Preso já está em movimentação temporária.',
    });
  });

  it('matches a pending return to the inmate via its currentMovement id', () => {
    const inmate = makeInmate({
      inMovement: true,
      currentMovement: { movementId: 500, movementTypeName: 'Audiência', exitDateTime: '2026-09-26T09:00:00.000Z' },
    });
    const pendingReturns = [makePendingReturn({ movementId: 500 })];

    expect(inmatePendingStatus(inmate, [], pendingReturns)).toEqual({ kind: 'pending' });
  });

  it('is "rejected" with the server reason when the queued return was rejected', () => {
    const inmate = makeInmate({
      inMovement: true,
      currentMovement: { movementId: 500, movementTypeName: 'Audiência', exitDateTime: '2026-09-26T09:00:00.000Z' },
    });
    const pendingReturns = [
      makePendingReturn({ movementId: 500, rejectionReason: 'Movimentação já foi encerrada.' }),
    ];

    expect(inmatePendingStatus(inmate, [], pendingReturns)).toEqual({
      kind: 'rejected',
      reason: 'Movimentação já foi encerrada.',
    });
  });

  it('does not match a pending item that belongs to a different inmate/movement', () => {
    const inmate = makeInmate({ id: 16, currentMovement: null });
    const pendingMovements = [makePendingMovement({ payload: { ...makePendingMovement().payload, inmateId: 99 } })];
    const pendingReturns = [makePendingReturn({ movementId: 501 })];

    expect(inmatePendingStatus(inmate, pendingMovements, pendingReturns)).toEqual({ kind: 'none' });
  });
});
