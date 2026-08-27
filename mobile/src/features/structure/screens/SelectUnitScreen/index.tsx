import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import ScreenHeader from '@/components/ScreenHeader';
import UnitCard from './components/UnitCard';
import { useSelectUnitScreenViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectUnit'>;

export default function SelectUnitScreen({ navigation }: Props): JSX.Element {
  const viewModel = useSelectUnitScreenViewModel(navigation);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Selecionar Unidade" />

      <View className="px-4 pb-8 pt-8">
        <View className="relative justify-center">
          <View className="absolute left-4 z-10">
            <Icon as={Search} size={18} color={colors.mutedForeground} />
          </View>
          <Input
            value={viewModel.search}
            onChangeText={viewModel.setSearch}
            placeholder="Buscar unidade..."
            className="bg-secondary rounded-full border-0 pl-12"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <Text variant="muted" className="px-4 pb-3 text-sm font-bold uppercase">
        Suas unidades
      </Text>

      <FlatList
        data={viewModel.units}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="gap-6 px-4 pb-4 pt-3"
        renderItem={({ item }) => (
          <UnitCard
            name={item.name}
            code={item.code}
            active={viewModel.currentUnitId === item.id}
            onPress={() => void viewModel.selectUnit(item.id)}
          />
        )}
        ListEmptyComponent={
          !viewModel.isLoading ? (
            <View className="p-4">
              <Text variant="muted" className="text-center">
                {viewModel.hasAnyUnit
                  ? 'Nenhuma unidade encontrada para essa busca.'
                  : 'Nenhuma unidade vinculada ao seu usuário.'}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
