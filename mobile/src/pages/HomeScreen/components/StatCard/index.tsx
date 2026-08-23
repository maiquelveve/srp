import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  sublabel: string;
}

export default function StatCard({ icon, value, label, sublabel }: StatCardProps): JSX.Element {
  return (
    <View className="bg-card border-border flex-1 items-center gap-2 rounded-2xl border p-3">
      <Icon as={icon} size={18} color={colors.primary} />
      <Text className="text-xl font-bold">{value}</Text>
      <View className="items-center">
        <Text className="text-xs font-semibold">{label}</Text>
        <Text variant="muted" className="text-xs">
          {sublabel}
        </Text>
      </View>
    </View>
  );
}
