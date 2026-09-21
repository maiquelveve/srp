import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClock } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import ScreenHeader from '@/components/ScreenHeader';
import DetailRow from '@/features/structure/screens/InmateDetailScreen/components/DetailRow';
import ScheduleRow from './components/ScheduleRow';
import { useRoutineDetailViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'RoutineDetail'>;

/** Detalhe de uma rotina do turno (FR-020) — read-only, sem escrita no mobile. */
export default function RoutineDetail({ route }: Props): JSX.Element {
  const viewModel = useRoutineDetailViewModel(route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Rotina" />

      <View className="flex-1 gap-7 px-4 py-6">
        <View className="items-center gap-3">
          <View className="bg-secondary border-primary h-24 w-24 items-center justify-center rounded-full border-2">
            <Icon as={CalendarClock} size={40} color={colors.primary} />
          </View>
          <Text variant="h4" className="text-center">
            {viewModel.name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              <Text className="text-xs font-bold uppercase">{viewModel.typeLabel}</Text>
            </Badge>
            <Badge variant={viewModel.isActive ? 'success' : 'secondary'} className="px-3 py-1">
              <Text className="text-xs font-bold uppercase">
                {viewModel.isActive ? 'Ativa' : 'Inativa'}
              </Text>
            </Badge>
          </View>
        </View>

        <View className="gap-3">
          <Text variant="muted" className="text-sm font-bold uppercase">
            Informações gerais
          </Text>
          <View className="bg-card gap-5 rounded-2xl p-5">
            <DetailRow divider label="Tipo" value={viewModel.typeLabel} />
            <DetailRow divider label="Galeria" value={viewModel.galleryCode} />
            <DetailRow label="Origem" value={viewModel.originLabel} />
          </View>
        </View>

        <View className="gap-3">
          <Text variant="muted" className="text-sm font-bold uppercase">
            Descrição
          </Text>
          <View className="bg-card rounded-2xl p-5">
            <Text variant={viewModel.description ? 'default' : 'muted'} className="text-base">
              {viewModel.description ?? 'Nenhuma descrição informada.'}
            </Text>
          </View>
        </View>

        {/* Só esta seção rola — o resto da tela fica fixo. */}
        <View className="flex-1 gap-3">
          <Text variant="muted" className="text-sm font-bold uppercase">
            Horários ({viewModel.schedules.length})
          </Text>
          {viewModel.schedules.length === 0 ? (
            <View className="bg-card rounded-2xl p-5">
              <Text variant="muted" className="text-base">
                Nenhum horário cadastrado.
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1" contentContainerClassName="gap-3">
              {viewModel.schedules.map((schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  weekdayLabel={schedule.weekdayLabel}
                  time={schedule.time}
                  active={schedule.active}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
