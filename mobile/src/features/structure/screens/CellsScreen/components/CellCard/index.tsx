import { Pressable, View } from 'react-native';
import { CircleCheck, DoorClosed, TriangleAlert } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

interface CellCardProps {
  code: string;
  capacity: number;
  occupancy: number;
  onPress: () => void;
}

export default function CellCard({ code, capacity, occupancy, onPress }: CellCardProps): JSX.Element {
  const isFull = occupancy >= capacity;

  return (
    <Pressable
      onPress={onPress}
      className="bg-secondary flex-row items-center gap-4 rounded-3xl p-5 active:opacity-70"
    >
      <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
        <Icon as={DoorClosed} size={24} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold">Cela {code}</Text>
        <Text variant="muted" className="text-base">
          Capacidade: {capacity}
        </Text>
      </View>
      <View
        className={cn(
          'flex-row items-center gap-1 rounded-full border px-2.5 py-1',
          isFull ? 'border-warning' : 'border-success',
        )}
      >
        <Icon
          as={isFull ? TriangleAlert : CircleCheck}
          size={12}
          color={isFull ? colors.warning : colors.success}
        />
        <Text
          className={cn('text-xs font-bold uppercase', isFull ? 'text-warning' : 'text-success')}
        >
          {occupancy}/{capacity} presos
        </Text>
      </View>
    </Pressable>
  );
}
