import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

interface ReadOnlyValueProps {
  children: ReactNode;
}

export default function ReadOnlyValue({ children }: ReadOnlyValueProps): JSX.Element {
  return (
    <View className="bg-muted rounded-md p-3">
      <Text>{children}</Text>
    </View>
  );
}
