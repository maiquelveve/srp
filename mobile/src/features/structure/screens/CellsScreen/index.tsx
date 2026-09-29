import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import ScreenHeader from '@/components/ScreenHeader';
import ListErrorState from '@/components/ListErrorState';
import OfflineDataBanner from '@/components/OfflineDataBanner';
import CellCard from './components/CellCard';
import { useCellsScreenViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'Cells'>;

export default function CellsScreen({ navigation, route }: Props): JSX.Element {
  const viewModel = useCellsScreenViewModel(navigation, route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={viewModel.title} />

      <Text variant="muted" className="px-4 pb-3 pt-6 text-sm font-bold uppercase">
        Celas da galeria
      </Text>

      {viewModel.loadState === 'loading' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : viewModel.loadState === 'error' ? (
        <ListErrorState message={viewModel.errorMessage} onRetry={viewModel.retry} />
      ) : (
        <>
          {viewModel.loadState === 'offline-with-data' && <OfflineDataBanner />}
          <FlatList
            className="flex-1"
            data={viewModel.cells}
            keyExtractor={(item) => String(item.id)}
            contentContainerClassName="gap-5 px-4 pb-4"
            renderItem={({ item }) => (
              <CellCard
                code={item.code}
                capacity={item.capacity}
                occupancy={item.occupancy}
                onPress={() => viewModel.goToInmates(item.id, item.code, item.capacity, item.occupancy)}
              />
            )}
            ListEmptyComponent={
              <View className="p-4">
                <Text variant="muted" className="text-center">
                  Nenhuma cela cadastrada nesta galeria.
                </Text>
              </View>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}
