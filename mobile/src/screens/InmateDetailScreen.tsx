import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ScreenHeader from '@/components/ScreenHeader';
import { useInmateDetailScreenViewModel } from './InmateDetailScreen.viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'InmateDetail'>;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function InmateDetailScreen({ route }: Props): JSX.Element {
  const vm = useInmateDetailScreenViewModel(route);

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Situação" />

      {vm.isLoading || !vm.inmate ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View className="items-center gap-4 p-6">
          <Avatar alt={`Foto de ${vm.inmate.name}`} className="h-20 w-20">
            {vm.inmate.photoUrl && <AvatarImage source={{ uri: vm.inmate.photoUrl }} />}
            <AvatarFallback>
              <Text variant="h4">{initials(vm.inmate.name)}</Text>
            </AvatarFallback>
          </Avatar>
          <Text variant="h4" className="text-center">
            {vm.inmate.name}
          </Text>

          <View className="bg-muted w-full gap-3 rounded-md p-4">
            <DetailRow label="Status" value={vm.inmate.status} />
            {vm.inmate.inMovement && vm.inmate.currentMovement && (
              <>
                <DetailRow label="Tipo de movimentação" value={vm.inmate.currentMovement.movementTypeName} />
                <DetailRow
                  label="Saída registrada em"
                  value={new Date(vm.inmate.currentMovement.exitDateTime).toLocaleString('pt-BR')}
                />
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View>
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      <Text>{value}</Text>
    </View>
  );
}
