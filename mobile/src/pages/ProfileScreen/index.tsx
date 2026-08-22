import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ScreenHeader from '@/components/ScreenHeader';
import { initials } from '@/lib/initials';
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

      <View className="items-center gap-4 p-6">
        <Avatar alt={`Foto de ${viewModel.name}`} className="h-20 w-20">
          <AvatarFallback>
            <Text variant="h4">{initials(viewModel.name)}</Text>
          </AvatarFallback>
        </Avatar>
        <Text variant="h4" className="text-center">
          {viewModel.name}
        </Text>

        <View className="bg-muted w-full gap-3 rounded-md p-4">
          <View>
            <Text variant="muted" className="text-xs">
              Perfil
            </Text>
            <Text>{viewModel.roleLabel}</Text>
          </View>
          <View>
            <Text variant="muted" className="text-xs">
              Unidade(s)
            </Text>
            <Text>{viewModel.unitNames.join(', ') || '—'}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
