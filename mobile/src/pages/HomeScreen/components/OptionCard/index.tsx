import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';

interface OptionCardProps {
  icon: LucideIcon;
  label: string;
  detail: string;
  onPress: () => void;
}

export default function OptionCard({ icon, label, detail, onPress }: OptionCardProps): JSX.Element {
  return (
    <Pressable onPress={onPress} className="active:scale-95 active:opacity-70">
      <Card className="bg-secondary rounded-3xl py-6">
        <CardContent className="flex-row items-center gap-4">
          <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
            <Icon as={icon} size={24} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold">{label}</Text>
            <Text variant="muted" className="text-muted-foreground mt-0.5 text-sm">
              {detail}
            </Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}
