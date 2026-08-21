import './global.css';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { UnitProvider } from '@/contexts/UnitContext';
import RootNavigator from '@/navigation/RootNavigator';
import Toaster from '@/components/Toaster';
import { startOfflineSyncListener, syncPendingMovements } from '@/offline/sync-service';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

export default function App(): JSX.Element {
  useEffect(() => {
    // Flush anything left over from a previous session (app killed mid-queue,
    // network already back by the time it's relaunched) in addition to the
    // listener, which only fires on a live connectivity *transition*.
    void syncPendingMovements();
    return startOfflineSyncListener();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UnitProvider>
            <RootNavigator />
            <Toaster />
            <StatusBar style="light" />
          </UnitProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
