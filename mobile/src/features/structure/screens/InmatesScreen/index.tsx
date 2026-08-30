import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import ScreenHeader from '@/components/ScreenHeader';
import InmateRow from './components/InmateRow';
import { useInmatesScreenViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'Inmates'>;

export default function InmatesScreen({ navigation, route }: Props): JSX.Element {
  const viewModel = useInmatesScreenViewModel(navigation, route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={viewModel.title} />

      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text variant="muted" className="text-sm capitalize">
          {viewModel.dateLabel}
        </Text>
        <Text className="font-semibold">{viewModel.occupancyLabel}</Text>
      </View>

      <FlatList
        data={viewModel.inmates}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="gap-4 px-4 pb-4"
        renderItem={({ item }) => (
          <InmateRow
            inmate={item}
            statusLine={viewModel.statusLine(item)}
            movementLabel={viewModel.movementActionLabel(item)}
            onPressDetail={() => viewModel.goToDetail(item.id)}
            onPressMovement={() => viewModel.goToMovementRegister(item)}
          />
        )}
        ListEmptyComponent={
          !viewModel.isLoading ? (
            <View className="p-4">
              <Text variant="muted" className="text-center">
                Nenhum preso nesta cela.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
