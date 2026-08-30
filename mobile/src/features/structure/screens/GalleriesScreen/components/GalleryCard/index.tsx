import { Pressable, View } from 'react-native';
import { Building2, CircleCheck, TriangleAlert } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

interface GalleryCardProps {
  code: string;
  cellCount: number;
  capacity: number;
  occupancy: number;
  onPress: () => void;
}

export default function GalleryCard({
  code,
  cellCount,
  capacity,
  occupancy,
  onPress,
}: GalleryCardProps): JSX.Element {
  const isFull = occupancy >= capacity;
  const freeSlots = Math.max(capacity - occupancy, 0);

  return (
    <Pressable
      onPress={onPress}
      className="bg-secondary flex-row items-center gap-4 rounded-3xl p-5 active:opacity-70"
    >
      <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
        <Icon as={Building2} size={24} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold">Galeria {code}</Text>
        <Text variant="muted" className="text-base">
          {cellCount} {cellCount === 1 ? 'cela' : 'celas'}
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
          {freeSlots} {freeSlots === 1 ? 'vaga livre' : 'vagas livres'}
        </Text>
      </View>
    </Pressable>
  );
}
