import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TriangleAlert } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

interface ConfirmMovementSheetProps {
  visible: boolean;
  inmateName: string;
  movementTypeName: string | null;
  destinationLocation: string;
  reason: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação de saída com revisão dos dados preenchidos — específica do
 * fluxo de Registrar Movimentação, não é o `ConfirmSheet` genérico (Sair,
 * Salvar) porque essa estrutura (caixa de revisão, ícone, cancelar em
 * vermelho) só faz sentido aqui.
 */
export default function ConfirmMovementSheet({
  visible,
  inmateName,
  movementTypeName,
  destinationLocation,
  reason,
  onConfirm,
  onCancel,
}: ConfirmMovementSheetProps): JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onCancel}>
        <Pressable
          className="bg-card rounded-t-3xl justify-between px-6 pt-8"
          style={{ paddingBottom: insets.bottom + 24, minHeight: 220 }}
        >
          <View>
            <View className="flex-row items-center gap-2">
              <Icon as={TriangleAlert} size={22} color={colors.primary} />
              <Text variant="h3" className="text-left uppercase">
                Confirmar saída?
              </Text>
            </View>

            <View className="border-border bg-background -mx-4 mt-5 rounded-2xl border p-4">
              <Text variant="muted" className="text-sm font-bold uppercase">
                Confira os dados
              </Text>
              <View className="border-border -mx-4 mt-4 border-t" />

              <View className="mt-5 gap-5">
                <View className="gap-1">
                  <Text variant="muted" className="text-sm">
                    Preso
                  </Text>
                  <Text className="text-lg font-bold uppercase">{inmateName}</Text>
                </View>
                <View className="border-border/50 border-t" />
                <View className="gap-1">
                  <Text variant="muted" className="text-sm">
                    Tipo de movimentação
                  </Text>
                  <Text className="text-lg font-bold">{movementTypeName}</Text>
                </View>
                <View className="border-border/50 border-t" />
                <View className="gap-1">
                  <Text variant="muted" className="text-sm">
                    Local de destino
                  </Text>
                  <Text className="text-lg font-bold">{destinationLocation}</Text>
                </View>
                {!!reason && (
                  <>
                    <View className="border-border/50 border-t" />
                    <View className="gap-1">
                      <Text variant="muted" className="text-sm">
                        Observações
                      </Text>
                      <Text className="text-lg font-bold">{reason}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

          <View className="mt-6 flex-row gap-3">
            <Button
              variant="outline"
              size="lg"
              className="border-destructive flex-1 rounded-full"
              onPress={onCancel}
            >
              <Text className="text-destructive text-lg font-bold">Cancelar</Text>
            </Button>
            <Button size="lg" className="flex-1 rounded-full" onPress={onConfirm}>
              <Text className="text-lg font-bold">Confirmar</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
