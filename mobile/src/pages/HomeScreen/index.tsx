import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ClipboardList, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import ConfirmSheet from '@/components/ConfirmSheet';
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
        <Text variant="muted">Bem-vindo,</Text>
        <Text variant="h3" className="text-left">
          {viewModel.userName}
        </Text>
      </View>

      <View className="gap-3 px-6">
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
        <Button variant="destructive" onPress={viewModel.requestLogout}>
          <Text>Sair</Text>
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

function OptionCard({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: typeof MapPin;
  label: string;
  detail: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <CardContent className="flex-row items-center gap-4">
          <View className="bg-accent h-11 w-11 items-center justify-center rounded-full">
            <Icon as={icon} size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">{label}</Text>
            <Text variant="muted" className="text-xs">
              {detail}
            </Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}
