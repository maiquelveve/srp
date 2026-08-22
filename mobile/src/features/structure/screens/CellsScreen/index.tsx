import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import ScreenHeader from '@/components/ScreenHeader';
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
      <FlatList
        data={viewModel.cells}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            className="border-border flex-row items-center justify-between border-b px-4 py-3.5"
            onPress={() => viewModel.goToInmates(item.id, item.code, item.capacity, item.occupancy)}
          >
            <Text>Cela {item.code}</Text>
            <Text variant="muted">
              {item.occupancy}/{item.capacity}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !viewModel.isLoading ? (
            <View className="p-4">
              <Text variant="muted">Nenhuma cela cadastrada nesta galeria.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
