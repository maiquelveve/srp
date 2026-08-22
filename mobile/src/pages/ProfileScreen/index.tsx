import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, IdCard, MapPin, ShieldCheck } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ScreenHeader from '@/components/ScreenHeader';
import { initials } from '@/lib/initials';
import InfoRow from './components/InfoRow';
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

      <View className="flex-1 justify-center gap-12 px-6 pb-6 pt-1">
        <View className="items-center gap-2">
          <Avatar alt={`Foto de ${viewModel.name}`} className="mb-2 h-36 w-36">
            <AvatarFallback>
              <Text variant="h1">{initials(viewModel.name)}</Text>
            </AvatarFallback>
          </Avatar>
          <Text variant="h3" className="text-center">
            {viewModel.name}
          </Text>
          <Text variant="muted" className="text-center text-base">
            {viewModel.email}
          </Text>
        </View>

        <View className="gap-7">
          <InfoRow
            icon={IdCard}
            label="Matrícula"
            value={viewModel.badgeNumber ?? 'Não informado'}
          />
          <InfoRow icon={Briefcase} label="Cargo" value={viewModel.jobTitle ?? 'Não informado'} />
          <InfoRow icon={ShieldCheck} label="Permissão" value={viewModel.roleLabel} />
          <InfoRow
            icon={MapPin}
            label="Lotação"
            value={viewModel.unitNames.join(', ') || 'Não informado'}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
