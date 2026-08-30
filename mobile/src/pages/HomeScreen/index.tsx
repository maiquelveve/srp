import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ClipboardList, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import OptionCard from '@/components/OptionCard';
import HomeHeader from './components/HomeHeader';
import { useHomeScreenViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props): JSX.Element {
  const viewModel = useHomeScreenViewModel(navigation);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <HomeHeader
        userName={viewModel.userName}
        firstName={viewModel.firstName}
        currentUnitCode={viewModel.currentUnitCode}
        inmatesTotal={viewModel.inmatesTotal}
        occupancyPercent={viewModel.occupancyPercent}
        openMovementsTotal={viewModel.openMovementsTotal}
        onPressAvatar={viewModel.goToProfile}
        onPressUnitLabel={viewModel.goToSelectUnit}
      />

      <Text variant="muted" className="mt-8 px-6 text-sm font-bold uppercase">
        Acessos rápidos
      </Text>

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 pb-6 pt-5">
        <OptionCard
          icon={MapPin}
          label="Selecionar Unidade"
          detail={viewModel.currentUnitName ?? 'Nenhuma selecionada'}
          onPress={viewModel.goToSelectUnit}
        />
        <OptionCard
          icon={ClipboardList}
          label="Movimentação"
          detail="Consultar presos e registrar"
          onPress={viewModel.goToMovement}
        />
        <OptionCard
          icon={User}
          label="Perfil"
          detail="Seus dados de acesso"
          onPress={viewModel.goToProfile}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
