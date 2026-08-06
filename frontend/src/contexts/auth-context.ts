import { createContext } from 'react';
import type { RoleName } from '@/features/structure/types';

export interface AuthUser {
  id: number;
  name: string;
  role: RoleName;
  units: number[];
}

export interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
