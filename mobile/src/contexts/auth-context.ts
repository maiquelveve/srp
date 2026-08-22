import { createContext } from 'react';

export type RoleName = 'PRISON_OFFICER' | 'SUPERVISOR' | 'WARDEN';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  badgeNumber: string | null;
  jobTitle: string | null;
  role: RoleName;
  units: number[];
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
