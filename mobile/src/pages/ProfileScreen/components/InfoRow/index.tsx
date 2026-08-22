import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

export default function InfoRow({ icon, label, value }: InfoRowProps): JSX.Element {
  return (
    <Card className="bg-secondary rounded-2xl py-4">
      <CardContent className="flex-row items-center gap-4">
        <View className="bg-card h-11 w-11 items-center justify-center rounded-full">
          <Icon as={icon} size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold uppercase">{label}</Text>
          <Text variant="muted" className="mt-0.5 text-sm">
            {value}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}
