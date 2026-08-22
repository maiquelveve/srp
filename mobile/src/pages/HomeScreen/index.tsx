import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ClipboardList, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import ConfirmSheet from '@/components/ConfirmSheet';
import OptionCard from './components/OptionCard';
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
      <View className="p-6">
        <Text variant="h3" className="text-left">
          {viewModel.userName}
        </Text>
        <Text variant="muted">Bem-vindo</Text>
      </View>

      <View className="gap-7 px-6">
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
      </View>

      <View className="mt-auto p-6">
        <Button
          variant="destructive"
          size="lg"
          className="w-full rounded-full"
          onPress={viewModel.requestLogout}
        >
          <Text className="text-lg font-bold">Sair</Text>
        </Button>
      </View>

      <ConfirmSheet
        visible={viewModel.confirmingLogout}
        title="Sair do aplicativo?"
        description="Você precisará entrar novamente com seu e-mail e senha."
        confirmLabel="Sair"
        destructive
        onConfirm={() => void viewModel.confirmLogout()}
        onCancel={viewModel.cancelLogout}
      />
    </SafeAreaView>
  );
}
