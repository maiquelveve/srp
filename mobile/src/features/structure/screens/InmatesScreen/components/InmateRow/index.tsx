import { View } from 'react-native';
import { Shuffle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { colors } from '@/theme/colors';
import { initials } from '@/lib/initials';
import { isExternalMovementType } from '@/features/structure/model';
import type { Inmate } from '@/features/structure/types';

interface InmateRowProps {
  inmate: Inmate;
  statusLine: string;
  movementLabel: string;
  onPressDetail: () => void;
  onPressTransfer: () => void;
  onPressMovement: () => void;
}

export default function InmateRow({
  inmate,
  statusLine,
  movementLabel,
  onPressDetail,
  onPressTransfer,
  onPressMovement,
}: InmateRowProps): JSX.Element {
  return (
    <View className="bg-secondary gap-6 rounded-3xl p-4">
      <View className="flex-row items-center gap-4">
        <Avatar alt={`Foto de ${inmate.name}`} className="h-16 w-16">
          {inmate.photoUrl && <AvatarImage source={{ uri: inmate.photoUrl }} />}
          <AvatarFallback className="bg-primary/20">
            <Text className="text-primary text-lg font-bold">{initials(inmate.name)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1 gap-1.5">
          <Text className="font-bold uppercase">{inmate.name}</Text>
          {inmate.inMovement && inmate.currentMovement ? (
            <Badge
              variant={
                isExternalMovementType(inmate.currentMovement.movementTypeName)
                  ? 'destructive'
                  : 'warning'
              }
              className="self-start"
            >
              <Text
                className={
                  isExternalMovementType(inmate.currentMovement.movementTypeName)
                    ? 'text-white text-xs font-bold uppercase'
                    : 'text-warning-foreground text-xs font-bold uppercase'
                }
              >
                {inmate.currentMovement.movementTypeName}
              </Text>
            </Badge>
          ) : (
            <Badge variant="success" className="self-start">
              <Text className="text-success-foreground text-xs font-bold uppercase">
                {statusLine}
              </Text>
            </Badge>
          )}
        </View>
      </View>

      <View className="flex-row gap-3">
        <Button
          variant="outline"
          className="border-primary bg-transparent flex-1 rounded-full"
          onPress={onPressDetail}
        >
          <Text className="text-primary text-base font-bold">Detalhes</Text>
        </Button>
        {/* Troca/permuta de cela (US3, FR-015/FR-015a) — ícone só, entre
            Detalhes e o botão de movimentação, pra não espremer o texto dos
            outros dois num row de 3 botões cheios. */}
        <Button
          variant="outline"
          size="icon"
          className="border-border bg-transparent rounded-full"
          onPress={onPressTransfer}
        >
          <Icon as={Shuffle} size={18} color={colors.foreground} />
        </Button>
        <Button className="flex-1 rounded-full" onPress={onPressMovement}>
          <Text className="text-primary-foreground text-base font-bold">{movementLabel}</Text>
        </Button>
      </View>
    </View>
  );
}
