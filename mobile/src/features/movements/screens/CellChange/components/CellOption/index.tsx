import { Pressable, View } from 'react-native';
import { Check, DoorClosed } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

interface CellOptionProps {
  code: string;
  capacity: number;
  occupancy: number;
  selected: boolean;
  onPress: () => void;
}

export default function CellOption({
  code,
  capacity,
  occupancy,
  selected,
  onPress,
}: CellOptionProps): JSX.Element {
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      <View
        className={cn(
          'bg-secondary flex-row items-center gap-3 rounded-2xl border p-4',
          selected ? 'border-primary' : 'border-transparent',
        )}
      >
        <View className="bg-card h-11 w-11 items-center justify-center rounded-full">
          <Icon as={DoorClosed} size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="font-bold">Cela {code}</Text>
          <Text variant="muted" className="text-sm">
            {occupancy}/{capacity} presos
          </Text>
        </View>
        {selected && <Icon as={Check} size={18} color={colors.primary} />}
      </View>
    </Pressable>
  );
}
