import { Pressable, View } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { colors } from '@/theme/colors';
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
  return (
    <Pressable
      onPress={onPress}
      className="bg-secondary flex-1 items-center gap-2 rounded-3xl p-4 active:opacity-70"
    >
      <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
        <Icon as={Building2} size={24} color={colors.primary} />
      </View>
      <Text className="text-center text-base font-bold">{code}</Text>
      <View className="items-center">
        <Text variant="muted" className="text-center text-sm">
          {cellCount} {cellCount === 1 ? 'cela' : 'celas'}
        </Text>
        <Text variant="muted" className="text-center text-sm">
          {occupancy}/{capacity} presos
        </Text>
      </View>
    </Pressable>
  );
}
