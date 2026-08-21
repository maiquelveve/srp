import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import ScreenHeader from '@/components/ScreenHeader';
import { useSelectUnitScreenViewModel } from './SelectUnitScreen.viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectUnit'>;

export default function SelectUnitScreen({ navigation }: Props): JSX.Element {
  const vm = useSelectUnitScreenViewModel(navigation);

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Selecionar Unidade" />
      <FlatList
        data={vm.units}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            className="border-border flex-row items-center justify-between border-b px-4 py-3.5"
            onPress={() => void vm.selectUnit(item.id)}
          >
            <Text>{item.name}</Text>
            {vm.currentUnitId === item.id && <Icon as={Check} size={18} color={colors.primary} />}
          </Pressable>
        )}
        ListEmptyComponent={
          !vm.isLoading ? (
            <View className="p-4">
              <Text variant="muted">Nenhuma unidade vinculada ao seu usuário.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
