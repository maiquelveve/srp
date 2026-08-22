import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import type { Inmate } from '@/features/structure/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ScreenHeader from '@/components/ScreenHeader';
import { initials } from '@/lib/initials';
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
              <Text variant="muted">Nenhum preso nesta cela.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function InmateRow({
  inmate,
  statusLine,
  movementLabel,
  onPressDetail,
  onPressMovement,
}: {
  inmate: Inmate;
  statusLine: string;
  movementLabel: string;
  onPressDetail: () => void;
  onPressMovement: () => void;
}): JSX.Element {
  return (
    <View className="border-border gap-3 border-b px-4 py-3.5">
      <View className="flex-row items-center gap-3">
        <Avatar alt={`Foto de ${inmate.name}`} className="h-11 w-11">
          {inmate.photoUrl && <AvatarImage source={{ uri: inmate.photoUrl }} />}
          <AvatarFallback>
            <Text className="text-sm font-semibold">{initials(inmate.name)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1">
          <Text className="font-medium">{inmate.name}</Text>
          <Text className="text-warning mt-0.5 text-xs">{statusLine}</Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Button variant="outline" size="sm" className="flex-1" onPress={onPressDetail}>
          <Text>Situação</Text>
        </Button>
        <Button size="sm" className="flex-1" onPress={onPressMovement}>
          <Text>{movementLabel}</Text>
        </Button>
      </View>
    </View>
  );
}
