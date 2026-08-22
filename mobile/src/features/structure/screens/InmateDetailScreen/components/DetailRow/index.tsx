import { View } from 'react-native';
import { Text } from '@/components/ui/text';

interface DetailRowProps {
  label: string;
  value: string;
}

export default function DetailRow({ label, value }: DetailRowProps): JSX.Element {
  return (
    <View>
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      <Text>{value}</Text>
    </View>
  );
}
