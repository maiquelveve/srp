import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
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
      <Card className="bg-secondary rounded-3xl py-7">
        <CardContent className="flex-row items-center gap-4">
          <View className="bg-card h-16 w-16 items-center justify-center rounded-full">
            <Icon as={icon} size={26} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-semibold">{label}</Text>
            <Text variant="muted" className="text-muted-foreground mt-0.5 text-base">
              {detail}
            </Text>
          </View>
          <Icon as={ChevronRight} size={22} color={colors.mutedForeground} />
        </CardContent>
      </Card>
    </Pressable>
  );
}
