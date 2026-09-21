import { View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

interface ScheduleRowProps {
  weekdayLabel: string;
  time: string;
  active: boolean;
}

export default function ScheduleRow({ weekdayLabel, time, active }: ScheduleRowProps): JSX.Element {
  return (
    <View
      className={cn('bg-card flex-row items-center gap-3 rounded-2xl p-4', !active && 'opacity-50')}
    >
      <View className="bg-secondary h-11 w-11 items-center justify-center rounded-full">
        <Icon as={Clock} size={20} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-bold">
          {weekdayLabel}
        </Text>
        {!active && (
          <Text variant="muted" className="text-xs uppercase">
            Inativo
          </Text>
        )}
      </View>
      <Text className="text-primary text-2xl font-bold">{time}</Text>
    </View>
  );
}
