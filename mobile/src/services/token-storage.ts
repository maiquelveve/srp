import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'srp:accessToken';
const REFRESH_TOKEN_KEY = 'srp:refreshToken';

export const tokenStorage = {
  getAccessToken: (): Promise<string | null> => AsyncStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): Promise<string | null> => AsyncStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: async (accessToken: string, refreshToken: string): Promise<void> => {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, accessToken],
      [REFRESH_TOKEN_KEY, refreshToken],
    ]);
  },
  clear: async (): Promise<void> => {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  },
};
