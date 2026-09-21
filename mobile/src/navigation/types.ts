import type { Inmate } from '@/features/structure/types';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  SelectUnit: undefined;
  Galleries: { unitId: number; unitName: string };
  Cells: { galleryId: number; galleryCode: string };
  Inmates: {
    cellId: number;
    cellCode: string;
    capacity: number;
    occupancy: number;
    galleryId: number;
    galleryCode: string;
  };
  InmateDetail: { inmateId: number; cellCode: string; galleryCode: string };
  Profile: undefined;
  MovementRegister: { inmate: Inmate; cellId: number };
  // Troca/permuta de cela (US3, FR-015/FR-015a, research.md #35) — só a
  // variação de mesma galeria existe no mobile (troca/permuta de galeria é
  // só web, restrita a SUPERVISOR/WARDEN).
  CellTransferSelect: {
    inmate: Inmate;
    cellId: number;
    cellCode: string;
    galleryId: number;
    galleryCode: string;
  };
  CellChange: {
    inmate: Inmate;
    cellId: number;
    cellCode: string;
    galleryId: number;
    galleryCode: string;
  };
  CellSwap: {
    inmate: Inmate;
    cellId: number;
    cellCode: string;
    galleryId: number;
    galleryCode: string;
  };
  // Rotinas do turno (US4, FR-020) — leitura, sem escrita no mobile
  // (contracts/routines.md restringe criação/edição ao painel web).
  ShiftRoutines: { unitId: number; unitName: string };
};
