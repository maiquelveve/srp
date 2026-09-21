import { View } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { ROUTINE_TYPE_LABEL, weekdayLabel } from '@/features/routines/labels';
import type { Routine } from '@/features/routines/types';

export default function RoutineListItem({ routine }: { routine: Routine }): JSX.Element {
  return (
    <View className="bg-secondary flex-row items-center gap-4 rounded-3xl p-5">
      <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
        <Icon as={CalendarClock} size={24} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold">{routine.name}</Text>
        <Text variant="muted" className="text-base">
          {ROUTINE_TYPE_LABEL[routine.type]}
        </Text>
        <Text variant="muted" className="mt-1 text-sm">
          {routine.schedules.map((s) => `${weekdayLabel(s.weekday)} ${s.time}`).join(' · ')}
        </Text>
      </View>
    </View>
  );
}
