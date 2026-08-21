import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação como bottom sheet (não o `Alert.alert()` nativo do Android).
 * `Modal` do próprio React Native (transparent + slide) em vez de
 * @rn-primitives/alert-dialog — mesmo efeito visual sem depender de portal/
 * reanimated (research.md #29).
 */
export default function ConfirmSheet({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmSheetProps): JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onCancel}>
        <Pressable className="bg-card rounded-t-2xl p-6" style={{ paddingBottom: insets.bottom + 24 }}>
          <Text variant="h4" className="text-left">
            {title}
          </Text>
          {description && (
            <Text variant="muted" className="mt-2">
              {description}
            </Text>
          )}

          <View className="mt-6 gap-2">
            <Button variant={destructive ? 'destructive' : 'default'} onPress={onConfirm}>
              <Text>{confirmLabel}</Text>
            </Button>
            <Button variant="outline" onPress={onCancel}>
              <Text>{cancelLabel}</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
