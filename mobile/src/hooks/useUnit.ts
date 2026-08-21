import { useContext } from 'react';
import { UnitContext, type UnitContextValue } from '@/contexts/unit-context';

export function useUnit(): UnitContextValue {
  const ctx = useContext(UnitContext);
  if (!ctx) {
    throw new Error('useUnit must be used within UnitProvider');
  }
  return ctx;
}
