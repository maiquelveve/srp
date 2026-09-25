import type { InmateStatus } from '../structure/types';

/** Período da data de registro (FR-016a). */
export type SituationPeriod = '6m' | '1y' | '5y' | 'all';

export interface DefinitiveSituation {
  movementId: number;
  inmateId: number;
  inmateName: string;
  registrationId: string | null;
  status: InmateStatus;
  /** Nome do tipo: Liberdade, Tornozeleira eletrônica ou Transferência. */
  situation: string;
  registeredAt: string;
  registeredByName: string;
  reason: string | null;
  galleryId: number;
  galleryCode: string;
  cellCode: string;
}
