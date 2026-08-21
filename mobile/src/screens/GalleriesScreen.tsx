import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import ScreenHeader from '@/components/ScreenHeader';
import { useGalleriesScreenViewModel } from './GalleriesScreen.viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'Galleries'>;

export default function GalleriesScreen({ navigation, route }: Props): JSX.Element {
  const vm = useGalleriesScreenViewModel(navigation, route);

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={['top', 'left', 'right']}>
      <ScreenHeader title={vm.title} />
      <FlatList
        data={vm.galleries}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            className="border-border border-b px-4 py-3.5"
            onPress={() => vm.goToCells(item.id, item.code)}
          >
            <Text>Galeria {item.code}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !vm.isLoading ? (
            <View className="p-4">
              <Text variant="muted">Nenhuma galeria cadastrada nesta unidade.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
