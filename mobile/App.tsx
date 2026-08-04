import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Placeholder root — screens (login, inmate lookup, movement register, shift
 * routines) are added per User Story (US1 onward, tasks.md Fase 3+). This
 * Foundational phase only wires up the API client (T024) and offline queue
 * infrastructure (T025).
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.container}>
        <Text>SRP — em construção.</Text>
        <StatusBar style="auto" />
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
