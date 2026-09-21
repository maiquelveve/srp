import { Pressable, View } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

export default function GalleryChip({
  code,
  selected,
  onPress,
}: {
  code: string;
  selected: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      className="active:opacity-70"
    >
      <View
        className={cn(
          'bg-secondary min-w-20 items-center gap-1.5 rounded-2xl border px-4 py-3',
          selected ? 'border-primary' : 'border-transparent',
        )}
      >
        <View
          className={cn(
            'h-9 w-9 items-center justify-center rounded-full',
            selected ? 'bg-primary' : 'bg-card',
          )}
        >
          <Icon
            as={Building2}
            size={16}
            color={selected ? colors.primaryForeground : colors.primary}
          />
        </View>
        <Text className={cn('text-sm font-bold', selected ? 'text-primary' : 'text-foreground')}>
          {code}
        </Text>
      </View>
    </Pressable>
  );
}
