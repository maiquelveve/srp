import { Pressable, View } from 'react-native';
import { Eye } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { colors } from '@/theme/colors';
import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';
import { isExternalMovementType, type InmatePendingStatus } from '@/features/structure/model';
import type { Inmate } from '@/features/structure/types';

interface InmateRowProps {
  inmate: Inmate;
  statusLine: string;
  movementLabel: string;
  pendingStatus: InmatePendingStatus;
  onPressDetail: () => void;
  onPressTransfer: () => void;
  onPressMovement: () => void;
}

export default function InmateRow({
  inmate,
  statusLine,
  movementLabel,
  pendingStatus,
  onPressDetail,
  onPressTransfer,
  onPressMovement,
}: InmateRowProps): JSX.Element {
  return (
    <View className="bg-secondary gap-6 rounded-3xl p-4">
      <View className="flex-row items-center gap-4">
        <View className="relative">
          <Avatar alt={`Foto de ${inmate.name}`} className="h-16 w-16">
            {inmate.photoUrl && <AvatarImage source={{ uri: inmate.photoUrl }} />}
            <AvatarFallback className="bg-primary/20">
              <Text className="text-primary text-lg font-bold">{initials(inmate.name)}</Text>
            </AvatarFallback>
          </Avatar>
          {/* Ícone de olho sobreposto no canto do avatar — abre o detalhe do
              preso; substitui o antigo botão "Detalhes" que disputava espaço
              na linha de ações abaixo. */}
          <Pressable
            className="bg-primary border-secondary absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2"
            onPress={onPressDetail}
            hitSlop={8}
          >
            <Icon as={Eye} size={12} color={colors.primaryForeground} />
          </Pressable>
        </View>
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
          {/* Selo de movimentação offline ainda não confirmada pelo servidor
              (T131, research.md #55) — "Recusada" nunca pode parecer igual a
              um item sincronizado com sucesso, por isso vermelho/destructive
              (não âmbar/warning) e com o motivo abaixo. */}
          {pendingStatus.kind === 'pending' && (
            <Badge variant="warning" className="self-start">
              <Text className="text-warning-foreground text-xs font-bold uppercase">Pendente</Text>
            </Badge>
          )}
          {pendingStatus.kind === 'rejected' && (
            <View className="gap-1">
              <Badge variant="destructive" className="self-start">
                <Text className="text-xs font-bold uppercase text-white">Recusada</Text>
              </Badge>
              <Text className="text-destructive text-xs" numberOfLines={2}>
                {pendingStatus.reason}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="flex-row gap-3">
        {/* Troca/permuta de cela (US3, FR-015/FR-015a) — no lugar do antigo
            botão "Detalhes" (movido pro ícone de olho no avatar). Esmaecido
            (não `disabled` de verdade — sem tooltip no mobile, o toque ainda
            precisa disparar o toast explicando o motivo) enquanto o preso
            está fora da cela numa movimentação temporária em aberto. */}
        <Button
          variant="outline"
          className={cn('border-primary bg-transparent flex-1 rounded-full', inmate.inMovement && 'opacity-40')}
          onPress={onPressTransfer}
        >
          <Text className="text-primary text-base font-bold">Trocar cela</Text>
        </Button>
        <Button className="flex-1 rounded-full" onPress={onPressMovement}>
          <Text className="text-primary-foreground text-base font-bold">{movementLabel}</Text>
        </Button>
      </View>
    </View>
  );
}
