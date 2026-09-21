import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import ScreenHeader from '@/components/ScreenHeader';
import GalleryChip from './components/GalleryChip';
import RoutineListItem from './components/RoutineListItem';
import { useShiftRoutinesViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'ShiftRoutines'>;

/** Leitura das rotinas programadas para o turno/dia atual (FR-020) — read-only, sem escrita no mobile. */
export default function ShiftRoutines(props: Props): JSX.Element {
  const viewModel = useShiftRoutinesViewModel(props);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={viewModel.title} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 pb-3 pt-6"
      >
        {viewModel.galleries.map((gallery) => (
          <GalleryChip
            key={gallery.id}
            code={gallery.code}
            selected={gallery.id === viewModel.selectedGalleryId}
            onPress={() => viewModel.selectGallery(gallery.id)}
          />
        ))}
      </ScrollView>

      <Text variant="muted" className="px-4 pb-3 text-sm font-bold uppercase">
        Rotinas de hoje
      </Text>

      {viewModel.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={viewModel.routines}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="gap-5 px-4 pb-4"
          renderItem={({ item }) => <RoutineListItem routine={item} />}
          ListEmptyComponent={
            <View className="p-4">
              <Text variant="muted" className="text-center">
                Nenhuma rotina programada para hoje nesta galeria.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
