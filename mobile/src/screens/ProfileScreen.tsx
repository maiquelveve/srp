import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ScreenHeader from '@/components/ScreenHeader';
import { useProfileScreenViewModel } from './ProfileScreen.viewmodel';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function ProfileScreen(): JSX.Element {
  const vm = useProfileScreenViewModel();

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Perfil" />

      <View className="items-center gap-4 p-6">
        <Avatar alt={`Foto de ${vm.name}`} className="h-20 w-20">
          <AvatarFallback>
            <Text variant="h4">{initials(vm.name)}</Text>
          </AvatarFallback>
        </Avatar>
        <Text variant="h4" className="text-center">
          {vm.name}
        </Text>

        <View className="bg-muted w-full gap-3 rounded-md p-4">
          <View>
            <Text variant="muted" className="text-xs">
              Perfil
            </Text>
            <Text>{vm.roleLabel}</Text>
          </View>
          <View>
            <Text variant="muted" className="text-xs">
              Unidade(s)
            </Text>
            <Text>{vm.unitNames.join(', ') || '—'}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
