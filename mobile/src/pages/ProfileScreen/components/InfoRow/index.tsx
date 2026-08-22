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
    <Card className="bg-secondary rounded-3xl py-6">
      <CardContent className="flex-row items-center gap-4">
        <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
          <Icon as={icon} size={24} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold uppercase">{label}</Text>
          <Text variant="muted" className="mt-0.5 text-base">
            {value}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}
