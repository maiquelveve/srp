import { useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UnitContext } from './unit-context';

const CURRENT_UNIT_KEY = 'srp:currentUnit';

/**
 * Unidade selecionada globalmente pelo Policial Penal (research.md #29) —
 * escolhida uma vez em SelectUnitScreen, reaproveitada pelo fluxo de
 * Movimentação sem repetir o passo a cada navegação.
 */
export function UnitProvider({ children }: { children: ReactNode }): JSX.Element {
  const [unitId, setUnitIdState] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void AsyncStorage.getItem(CURRENT_UNIT_KEY).then((stored) => {
      if (stored) {
        setUnitIdState(Number(stored));
      }
      setIsLoading(false);
    });
  }, []);

  async function setUnitId(id: number): Promise<void> {
    await AsyncStorage.setItem(CURRENT_UNIT_KEY, String(id));
    setUnitIdState(id);
  }

  return (
    <UnitContext.Provider value={{ unitId, isLoading, setUnitId }}>{children}</UnitContext.Provider>
  );
}
