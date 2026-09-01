import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { CellHistoryReason, InmateCellHistory } from './entities/inmate-cell-history.entity';
import { Inmate } from './entities/inmate.entity';
import { Cell } from '../cells/entities/cell.entity';
import { User } from '../users/entities/user.entity';

/**
 * Timeline of cell occupancy per inmate (FR-016). Every entry/exit MUST be
 * written inside the same transaction as the status/currentCell change that
 * causes it (Constitution IV) — callers always pass the transaction's own
 * `EntityManager` rather than a repository injected here.
 */
@Injectable()
export class CellHistoryService {
  /** Opens the very first entry for a newly-created inmate (InmatesService.create). */
  async openInitialEntry(manager: EntityManager, inmate: Inmate, cell: Cell): Promise<void> {
    await manager.save(
      manager.create(InmateCellHistory, {
        inmate,
        cell,
        entryDate: new Date(),
        exitDate: null,
        reason: null,
        user: null,
      }),
    );
  }

  /**
   * Closes the inmate's currently-open entry (if any) and, when `newCell` is
   * given, opens a new one — used by every situação definitiva (contracts/
   * movements.md): troca de cela closes+opens; liberdade/tornozeleira/
   * transferência only close. `Inmate.currentCell` is kept pointing at the
   * last occupied cell as a historical marker in the close-only case —
   * `CellsService.occupancyOf` already filters by `status = ACTIVE`, so the
   * cell is correctly freed without needing to null the column (Constitution
   * VI, same reasoning as `inmates.status` being the single derived source).
   */
  async closeAndMaybeOpen(
    manager: EntityManager,
    inmate: Inmate,
    reason: CellHistoryReason,
    user: User,
    newCell?: Cell,
  ): Promise<void> {
    const openEntry = await manager.findOne(InmateCellHistory, {
      where: { inmate: { id: inmate.id }, exitDate: IsNull() },
    });
    const now = new Date();
    if (openEntry) {
      openEntry.exitDate = now;
      openEntry.reason = reason;
      openEntry.user = user;
      await manager.save(openEntry);
    }
    if (newCell) {
      await manager.save(
        manager.create(InmateCellHistory, {
          inmate,
          cell: newCell,
          entryDate: now,
          exitDate: null,
          reason: null,
          user,
        }),
      );
    }
  }
}
