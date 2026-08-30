import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeftRight, CircleCheck, Clock, UserRound } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import ScreenHeader from '@/components/ScreenHeader';
import {
  inmateStatusLabel,
  isExternalMovementType,
  movementTimeLabel,
} from '@/features/structure/model';
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
        <View className="gap-7 px-4 py-6">
          <View className="items-center gap-3">
            <Avatar
              alt={`Foto de ${viewModel.inmate.name}`}
              className="border-primary h-28 w-28 border-2"
            >
              {viewModel.inmate.photoUrl && (
                <AvatarImage source={{ uri: viewModel.inmate.photoUrl }} />
              )}
              <AvatarFallback>
                <Icon as={UserRound} size={44} color={colors.mutedForeground} />
              </AvatarFallback>
            </Avatar>
            <Text variant="h4" className="text-center uppercase">
              {viewModel.inmate.name}
            </Text>
          </View>

          <View className="gap-3">
            <Text variant="muted" className="text-sm font-bold uppercase">
              Informações gerais
            </Text>
            <View className="bg-card gap-5 rounded-2xl p-5">
              <DetailRow divider label="Status" value={inmateStatusLabel(viewModel.inmate.status)} />
              <DetailRow divider label="Cela" value={viewModel.cellCode} />
              <DetailRow divider label="Galeria" value={viewModel.galleryCode} />
              <DetailRow label="Matrícula" value={viewModel.inmate.registrationNumber ?? 'Não informada'} />
            </View>
          </View>

          <View className="gap-3">
            <Text variant="muted" className="text-sm font-bold uppercase">
              Detalhes de movimentação
            </Text>
            {viewModel.inmate.inMovement && viewModel.inmate.currentMovement ? (
              <View className="relative">
                <View
                  className={cn(
                    'bg-card flex-row items-center gap-3 rounded-2xl border p-5',
                    isExternalMovementType(viewModel.inmate.currentMovement.movementTypeName)
                      ? 'border-destructive'
                      : 'border-warning',
                  )}
                >
                  <View className="bg-secondary h-12 w-12 items-center justify-center rounded-full">
                    <Icon as={ArrowLeftRight} size={22} color={colors.primary} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-lg font-bold">
                      {viewModel.inmate.currentMovement.movementTypeName}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Icon as={Clock} size={12} color={colors.mutedForeground} />
                      <Text variant="muted" className="text-xs uppercase">
                        {movementTimeLabel(viewModel.inmate.currentMovement.exitDateTime)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Badge className="absolute -top-2 right-4">
                  <Text className="text-primary-foreground text-xs font-bold uppercase">Ativa</Text>
                </Badge>
              </View>
            ) : (
              <View className="bg-card border-success flex-row items-center gap-3 rounded-2xl border p-5">
                <View className="bg-secondary h-12 w-12 items-center justify-center rounded-full">
                  <Icon as={CircleCheck} size={22} color={colors.success} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-lg font-bold">Sem movimentação</Text>
                  <Text variant="muted" className="text-sm">
                    Preso permanece na cela.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
