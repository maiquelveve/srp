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
    galleryCode: string;
  };
  InmateDetail: { inmateId: number; cellCode: string; galleryCode: string };
  Profile: undefined;
  MovementRegister: { inmate: Inmate; cellId: number };
};
