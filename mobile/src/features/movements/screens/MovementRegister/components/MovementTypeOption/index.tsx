import { Pressable, View } from 'react-native';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';

interface MovementTypeOptionProps {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function MovementTypeOption({
  icon,
  label,
  selected,
  onPress,
}: MovementTypeOptionProps): JSX.Element {
  return (
    <Pressable onPress={onPress} className="relative active:opacity-70">
      <View
        className={cn(
          'bg-secondary flex-row items-center gap-3 rounded-2xl border p-4',
          selected ? 'border-primary' : 'border-transparent',
        )}
      >
        <View className="bg-card h-11 w-11 items-center justify-center rounded-full">
          <Icon as={icon} size={20} color={colors.primary} />
        </View>
        <Text className="flex-1 font-bold">{label}</Text>
        <Icon
          as={selected ? Check : ChevronRight}
          size={selected ? 18 : 20}
          color={selected ? colors.primary : colors.mutedForeground}
        />
      </View>
      {selected && (
        <Badge className="absolute -top-2 right-4">
          <Text className="text-primary-foreground text-xs font-bold uppercase">Selecionada</Text>
        </Badge>
      )}
    </Pressable>
  );
}
