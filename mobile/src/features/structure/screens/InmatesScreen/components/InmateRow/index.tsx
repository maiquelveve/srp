import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/initials';
import type { Inmate } from '@/features/structure/types';

interface InmateRowProps {
  inmate: Inmate;
  statusLine: string;
  movementLabel: string;
  onPressDetail: () => void;
  onPressMovement: () => void;
}

export default function InmateRow({
  inmate,
  statusLine,
  movementLabel,
  onPressDetail,
  onPressMovement,
}: InmateRowProps): JSX.Element {
  return (
    <View className="border-border gap-3 border-b px-4 py-3.5">
      <View className="flex-row items-center gap-3">
        <Avatar alt={`Foto de ${inmate.name}`} className="h-11 w-11">
          {inmate.photoUrl && <AvatarImage source={{ uri: inmate.photoUrl }} />}
          <AvatarFallback>
            <Text className="text-sm font-semibold">{initials(inmate.name)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1">
          <Text className="font-medium">{inmate.name}</Text>
          <Text className="text-warning mt-0.5 text-xs">{statusLine}</Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Button variant="outline" size="sm" className="flex-1" onPress={onPressDetail}>
          <Text>Situação</Text>
        </Button>
        <Button size="sm" className="flex-1" onPress={onPressMovement}>
          <Text>{movementLabel}</Text>
        </Button>
      </View>
    </View>
  );
}
