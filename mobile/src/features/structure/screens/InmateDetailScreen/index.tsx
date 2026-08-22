import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ScreenHeader from '@/components/ScreenHeader';
import { initials } from '@/lib/initials';
import DetailRow from './components/DetailRow';
import { useInmateDetailScreenViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'InmateDetail'>;

export default function InmateDetailScreen({ route }: Props): JSX.Element {
  const viewModel = useInmateDetailScreenViewModel(route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Situação" />

      {viewModel.isLoading || !viewModel.inmate ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View className="items-center gap-4 p-6">
          <Avatar alt={`Foto de ${viewModel.inmate.name}`} className="h-20 w-20">
            {viewModel.inmate.photoUrl && (
              <AvatarImage source={{ uri: viewModel.inmate.photoUrl }} />
            )}
            <AvatarFallback>
              <Text variant="h4">{initials(viewModel.inmate.name)}</Text>
            </AvatarFallback>
          </Avatar>
          <Text variant="h4" className="text-center">
            {viewModel.inmate.name}
          </Text>

          <View className="bg-muted w-full gap-3 rounded-md p-4">
            <DetailRow label="Status" value={viewModel.inmate.status} />
            {viewModel.inmate.inMovement && viewModel.inmate.currentMovement && (
              <>
                <DetailRow
                  label="Tipo de movimentação"
                  value={viewModel.inmate.currentMovement.movementTypeName}
                />
                <DetailRow
                  label="Saída registrada em"
                  value={new Date(viewModel.inmate.currentMovement.exitDateTime).toLocaleString(
                    'pt-BR',
                  )}
                />
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
