import type { Inmate } from '@/features/structure/types';

export type RootStackParamList = {
  Login: undefined;
  InmatesLookup: undefined;
  MovementRegister: { inmate: Inmate; cellId: number };
};
