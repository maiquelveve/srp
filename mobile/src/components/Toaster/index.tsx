import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToast, type ToastState, type ToastVariant } from '@/lib/toast';
import { Text } from '@/components/ui/text';

const VARIANT_CLASS: Record<ToastVariant, string> = {
  success: 'bg-success',
  error: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-info',
};

const VARIANT_TEXT_CLASS: Record<ToastVariant, string> = {
  success: 'text-success-foreground',
  error: 'text-destructive-foreground',
  warning: 'text-warning-foreground',
  info: 'text-info-foreground',
};

export default function Toaster(): JSX.Element | null {
  const [toast, setToast] = useState<ToastState | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => subscribeToast(setToast), []);

  if (!toast) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute left-4 right-4 z-50"
      style={{ top: insets.top + 8 }}
    >
      <View className={`rounded-lg px-4 py-3 shadow-lg shadow-black/20 ${VARIANT_CLASS[toast.variant]}`}>
        <Text className={`text-sm font-medium ${VARIANT_TEXT_CLASS[toast.variant]}`}>{toast.message}</Text>
      </View>
    </View>
  );
}
