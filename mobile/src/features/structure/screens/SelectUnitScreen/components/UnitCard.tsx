import { Pressable, View } from 'react-native';
import { Building2, Check, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';

interface UnitCardProps {
  name: string;
  code: string | null;
  active: boolean;
  onPress: () => void;
}

export default function UnitCard({ name, code, active, onPress }: UnitCardProps): JSX.Element {
  return (
    <Pressable onPress={onPress} className="relative active:scale-95 active:opacity-70">
      <Card className={cn('bg-secondary rounded-3xl py-6', active && 'border-primary')}>
        <CardContent className="flex-row items-center gap-4">
          <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
            <Icon as={Building2} size={22} color={colors.primary} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-lg font-semibold">{name}</Text>
            {code && (
              <Text variant="muted" className="text-muted-foreground text-base">
                {code}
              </Text>
            )}
          </View>
          {active ? (
            <Icon as={Check} size={22} color={colors.primary} />
          ) : (
            <Icon as={ChevronRight} size={22} color={colors.mutedForeground} />
          )}
        </CardContent>
      </Card>
      {active && (
        <Badge className="absolute -top-2 right-4">
          <Text className="text-primary-foreground text-xs font-bold uppercase">Ativa</Text>
        </Badge>
      )}
    </Pressable>
  );
}
