import { Pressable, View } from 'react-native';
import { CalendarClock, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { ROUTINE_TYPE_LABEL, weekdayLabel } from '@/features/routines/labels';
import { toHHMM } from '@/features/routines/time';
import type { Routine } from '@/features/routines/types';

interface RoutineListItemProps {
  routine: Routine;
  onPress: () => void;
}

// Todo texto do card fica em uma linha (`numberOfLines={1}`) — assim todos os
// cards têm a mesma altura, independente de quantos horários a rotina tem.
export default function RoutineListItem({ routine, onPress }: RoutineListItemProps): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className="bg-secondary flex-row items-center gap-4 rounded-3xl p-5 active:opacity-70"
    >
      <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
        <Icon as={CalendarClock} size={24} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} ellipsizeMode="tail" className="text-lg font-bold">
          {routine.name}
        </Text>
        <Text variant="muted" numberOfLines={1} ellipsizeMode="tail" className="text-base">
          {ROUTINE_TYPE_LABEL[routine.type]}
        </Text>
        <Text variant="muted" numberOfLines={1} ellipsizeMode="tail" className="mt-1 text-sm">
          {routine.schedules
            .map((schedule) => `${weekdayLabel(schedule.weekday)} ${toHHMM(schedule.time)}`)
            .join(' · ')}
        </Text>
      </View>
      <Icon as={ChevronRight} size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}
