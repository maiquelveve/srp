import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import RootNavigator from '@/navigation/RootNavigator';
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
