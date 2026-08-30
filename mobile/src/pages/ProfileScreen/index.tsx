import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, IdCard, Mail, MapPin, ShieldCheck } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ScreenHeader from '@/components/ScreenHeader';
import ConfirmSheet from '@/components/ConfirmSheet';
import { initials } from '@/lib/initials';
import InfoRow from './components/InfoRow';
import InfoChip from './components/InfoChip';
import { useProfileScreenViewModel } from './viewmodel';

export default function ProfileScreen(): JSX.Element {
  const viewModel = useProfileScreenViewModel();

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Perfil" />

      <ScrollView className="flex-1" contentContainerClassName="gap-8 px-6 pb-6 pt-6">
        <View className="items-center gap-2">
          <Avatar alt={`Foto de ${viewModel.name}`} className="border-primary h-28 w-28 border-2">
            <AvatarFallback>
              <Text variant="h1">{initials(viewModel.name)}</Text>
            </AvatarFallback>
          </Avatar>
          <Text variant="h3" className="text-center">
            {viewModel.name}
          </Text>
          <Text variant="muted" className="text-muted-foreground text-center text-lg">
            {viewModel.email}
          </Text>
          <View className="border-primary mt-1 rounded-full border px-5 py-2">
            <Text className="text-primary text-sm font-bold">
              {viewModel.jobTitle ?? viewModel.roleLabel}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <InfoChip
            icon={IdCard}
            label="Matrícula"
            value={viewModel.badgeNumber ?? 'Não informado'}
          />
          <InfoChip icon={Briefcase} label="Cargo" value={viewModel.jobTitle ?? 'Não informado'} />
          <InfoChip icon={ShieldCheck} label="Permissão" value={viewModel.roleLabel} />
        </View>

        <View className="gap-4">
          <Text variant="muted" className="text-sm font-bold uppercase">
            Informações complementares
          </Text>
          <View className="gap-6">
            <InfoRow
              icon={MapPin}
              label="Lotação"
              value={viewModel.unitNames.join(', ') || 'Não informado'}
            />
            <InfoRow icon={Mail} label="E-mail institucional" value={viewModel.email} />
          </View>
        </View>

        <Button
          variant="destructive"
          size="lg"
          className="w-full rounded-full"
          onPress={viewModel.requestLogout}
        >
          <Text className="text-lg font-bold">Sair</Text>
        </Button>
      </ScrollView>

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
