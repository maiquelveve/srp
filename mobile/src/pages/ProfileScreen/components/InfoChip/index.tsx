import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

interface InfoChipProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

export default function InfoChip({ icon, label, value }: InfoChipProps): JSX.Element {
  return (
    <View className="bg-card border-border flex-1 items-center gap-2 rounded-2xl border p-4">
      <View className="bg-secondary h-12 w-12 items-center justify-center rounded-full">
        <Icon as={icon} size={20} color={colors.primary} />
      </View>
      <Text className="text-center text-base font-semibold">{label}</Text>
      <Text variant="muted" className="text-muted-foreground text-center text-base">
        {value}
      </Text>
    </View>
  );
}
