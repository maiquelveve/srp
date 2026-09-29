import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import ScreenHeader from '@/components/ScreenHeader';
import ListErrorState from '@/components/ListErrorState';
import OfflineDataBanner from '@/components/OfflineDataBanner';
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

      {viewModel.galleriesLoadState === 'error' ? (
        <ListErrorState message={viewModel.galleriesErrorMessage} onRetry={viewModel.retryGalleries} />
      ) : (
        <>
          {viewModel.galleriesLoadState === 'offline-with-data' && <OfflineDataBanner />}

          <Text variant="muted" className="px-4 pb-4 pt-6 text-sm font-bold uppercase">
            Galerias
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="h-28 grow-0"
            contentContainerClassName="flex-row items-start gap-3 px-4"
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

          <Text variant="muted" className="px-4 pb-4 pt-4 text-sm font-bold uppercase">
            Rotinas de hoje
          </Text>

          {viewModel.routinesLoadState === 'loading' ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : viewModel.routinesLoadState === 'error' ? (
            <ListErrorState message={viewModel.routinesErrorMessage} onRetry={viewModel.retryRoutines} />
          ) : (
            <>
              {viewModel.routinesLoadState === 'offline-with-data' && <OfflineDataBanner />}
              <FlatList
                className="flex-1"
                data={viewModel.routines}
                keyExtractor={(item) => String(item.id)}
                contentContainerClassName="gap-6 px-4 pb-6"
                renderItem={({ item }) => (
                  <RoutineListItem routine={item} onPress={() => viewModel.goToRoutineDetail(item)} />
                )}
                ListEmptyComponent={
                  <View className="p-4">
                    <Text variant="muted" className="text-center">
                      Nenhuma rotina programada para hoje nesta galeria.
                    </Text>
                  </View>
                }
              />
            </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
