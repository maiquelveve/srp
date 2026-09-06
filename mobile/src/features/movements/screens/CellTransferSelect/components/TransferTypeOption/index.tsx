import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';

interface TransferTypeOptionProps {
  icon: LucideIcon;
  label: string;
  detail: string;
  checking: boolean;
  available: boolean;
  /** Só usado quando `!available` — vira o toast do toque, já que não há tooltip no mobile (docs/style-guide.md #6). */
  unavailableReason: string;
  onPress: () => void;
}

/**
 * Mesmo padrão visual do `OptionCard` genérico, mas com estado de
 * disponibilidade (badge "Verificando..."/"Indisponível" + card esmaecido) —
 * rico e específico demais pra virar prop condicional do componente
 * compartilhado (ver feedback_no_prop_explosion_shared_components). Espelha
 * o `CellTransferDialog` do web (research.md #35 "Decision — UI"): sem
 * checar disponibilidade antes, o usuário entra num fluxo cujo passo 1
 * aparece vazio sem explicação, parecendo bug.
 */
export default function TransferTypeOption({
  icon,
  label,
  detail,
  checking,
  available,
  unavailableReason,
  onPress,
}: TransferTypeOptionProps): JSX.Element {
  const disabled = checking || !available;

  return (
    <Pressable
      className={disabled ? undefined : 'active:scale-95 active:opacity-70'}
      onPress={() => {
        if (checking) return;
        if (!available) {
          toast.warning(unavailableReason);
          return;
        }
        onPress();
      }}
    >
      <Card className={cn('bg-secondary rounded-3xl py-7', disabled && 'opacity-50')}>
        <CardContent className="flex-row items-center gap-4">
          <View className="bg-card h-16 w-16 items-center justify-center rounded-full">
            <Icon as={icon} size={26} color={colors.primary} />
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-xl font-semibold">{label}</Text>
              {disabled && (
                <Badge variant={checking ? 'outline' : 'destructive'}>
                  <Text className="text-xs font-bold uppercase">
                    {checking ? 'Verificando...' : 'Indisponível'}
                  </Text>
                </Badge>
              )}
            </View>
            <Text variant="muted" className="text-muted-foreground text-base">
              {detail}
            </Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}
