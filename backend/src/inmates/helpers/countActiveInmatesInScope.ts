import { EntityManager } from 'typeorm';
import { Inmate, InmateStatus } from '../entities/inmate.entity';

export type ActiveInmateScope =
  | { level: 'unit'; unitId: number }
  | { level: 'gallery'; galleryId: number }
  | { level: 'cell'; cellId: number };

/**
 * Counts ACTIVE inmates within a Unit/Gallery/Cell subtree — shared by
 * UnitsService/GalleriesService/CellsService's deactivation-cascade guard
 * (research.md #23: desativar Unidade/Galeria/Cela é bloqueado enquanto
 * houver preso ACTIVE em qualquer Cela do escopo).
 *
 * Plain function, not a NestJS provider, on purpose: importing
 * InmatesModule/InmatesService from Units/Galleries to reuse this would
 * create a circular module dependency (InmatesModule already depends on
 * Cells -> Galleries -> Units), and this query has no side effects or
 * business logic beyond "status = ACTIVE within scope" that would justify
 * routing it through the DI graph instead of just calling a function.
 */
export async function countActiveInmatesInScope(
  manager: EntityManager,
  scope: ActiveInmateScope,
): Promise<number> {
  const queryBuilder = manager
    .createQueryBuilder(Inmate, 'inmate')
    .innerJoin('inmate.currentCell', 'cell')
    .andWhere('inmate.status = :status', { status: InmateStatus.ACTIVE });

  switch (scope.level) {
    case 'cell':
      queryBuilder.andWhere('cell.id = :cellId', { cellId: scope.cellId });
      break;
    case 'gallery':
      queryBuilder.andWhere('cell.gallery_id = :galleryId', { galleryId: scope.galleryId });
      break;
    case 'unit':
      queryBuilder
        .innerJoin('cell.gallery', 'gallery')
        .andWhere('gallery.unit_id = :unitId', { unitId: scope.unitId });
      break;
  }

  return queryBuilder.getCount();
}
