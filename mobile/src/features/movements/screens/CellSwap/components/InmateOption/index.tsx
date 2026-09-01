import { Pressable, View } from 'react-native';
import { Check, User } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';

interface InmateOptionProps {
  name: string;
  inMovement: boolean;
  selected: boolean;
  onPress: () => void;
}

/**
 * Mesmo padrão visual de `CellOption` (cela de destino) — cela compartilhada
 * pode ter mais de um ocupante ativo, então a permuta precisa deixar
 * escolher qual deles é o segundo preso (research.md #36). Continua
 * selecionável mesmo `inMovement` (o preso pode estar em atendimento
 * médico etc.) — só o botão Confirmar da tela fica bloqueado nesse caso,
 * pra deixar claro o motivo em vez de esconder o candidato da lista.
 */
export default function InmateOption({
  name,
  inMovement,
  selected,
  onPress,
}: InmateOptionProps): JSX.Element {
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      <View
        className={cn(
          'bg-secondary flex-row items-center gap-3 rounded-2xl border p-4',
          selected ? 'border-primary' : 'border-transparent',
        )}
      >
        <View className="bg-card h-11 w-11 items-center justify-center rounded-full">
          <Icon as={User} size={20} color={colors.primary} />
        </View>
        <View className="flex-1 gap-1.5">
          <Text className="font-bold uppercase">{name}</Text>
          {inMovement && (
            <Badge variant="destructive" className="self-start">
              <Text className="text-xs font-bold uppercase text-white">Em movimentação</Text>
            </Badge>
          )}
        </View>
        {selected && <Icon as={Check} size={18} color={colors.primary} />}
      </View>
    </Pressable>
  );
}
