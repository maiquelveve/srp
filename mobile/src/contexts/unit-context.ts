import { createContext } from 'react';

export interface UnitContextValue {
  unitId: number | null;
  isLoading: boolean;
  setUnitId: (unitId: number) => Promise<void>;
}

export const UnitContext = createContext<UnitContextValue | undefined>(undefined);
