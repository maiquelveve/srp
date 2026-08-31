import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CloudOff } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import ScreenHeader from '@/components/ScreenHeader';
import { pendingSyncLabel } from '@/features/structure/model';
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
        <Text variant="muted" className="text-sm">
          {viewModel.dateLabel}
        </Text>
        <Text className="font-semibold">{viewModel.occupancyLabel}</Text>
      </View>

      {viewModel.pendingSyncCount > 0 && (
        <View className="border-warning bg-warning/10 mx-4 mb-2 flex-row items-center gap-3 rounded-2xl border p-4">
          <Icon as={CloudOff} size={18} color={colors.warning} />
          <Text className="text-warning flex-1 text-sm font-semibold">
            {pendingSyncLabel(viewModel.pendingSyncCount)}
          </Text>
        </View>
      )}

      {viewModel.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          className="flex-1"
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
            <View className="p-4">
              <Text variant="muted" className="text-center">
                Nenhum preso nesta cela.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
