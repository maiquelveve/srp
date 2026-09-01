import { View } from 'react-native';
import { ArrowLeftRight, Repeat } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import ScreenHeader from '@/components/ScreenHeader';
import OptionCard from '@/components/OptionCard';
import { useCellTransferSelectViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'CellTransferSelect'>;

/**
 * Seleção do tipo de troca de cela (US3, FR-015/FR-015a, research.md #35) —
 * só as duas variações de mesma galeria existem no mobile; troca/permuta de
 * galeria são exclusivas do painel web (SUPERVISOR/WARDEN).
 */
export default function CellTransferSelect({ navigation, route }: Props): JSX.Element {
  const viewModel = useCellTransferSelectViewModel(navigation, route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Trocar de Cela" />

      <View className="gap-1 px-4 pb-4 pt-6">
        <Text variant="muted" className="text-sm font-bold uppercase">
          Preso
        </Text>
        <Text className="text-lg font-bold uppercase">{viewModel.inmate.name}</Text>
      </View>

      <View className="gap-4 px-4">
        <OptionCard
          icon={ArrowLeftRight}
          label="Troca de cela"
          detail="Move o preso para outra cela com vaga, na mesma galeria."
          onPress={viewModel.goToCellChange}
        />
        <OptionCard
          icon={Repeat}
          label="Permuta de cela"
          detail="Troca o preso com outro, ambos na mesma galeria — sem precisar de vaga."
          onPress={viewModel.goToCellSwap}
        />
      </View>
    </SafeAreaView>
  );
}
