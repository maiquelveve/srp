import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import ScreenHeader from '@/components/ScreenHeader';
import GalleryCard from './components/GalleryCard';
import { useGalleriesScreenViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'Galleries'>;

export default function GalleriesScreen({ navigation, route }: Props): JSX.Element {
  const viewModel = useGalleriesScreenViewModel(navigation, route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={viewModel.title} />

      <Text variant="muted" className="px-4 pb-3 pt-6 text-sm font-bold uppercase">
        Galerias da unidade
      </Text>

      {viewModel.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={viewModel.galleries}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="gap-5 px-4 pb-4"
          renderItem={({ item }) => (
            <GalleryCard
              code={item.code}
              cellCount={item.cellCount}
              capacity={item.capacity}
              occupancy={item.occupancy}
              onPress={() => viewModel.goToCells(item.id, item.code)}
            />
          )}
          ListEmptyComponent={
            <View className="p-4">
              <Text variant="muted" className="text-center">
                Nenhuma galeria cadastrada nesta unidade.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
