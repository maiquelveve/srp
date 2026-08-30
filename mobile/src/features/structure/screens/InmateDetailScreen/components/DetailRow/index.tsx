import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

interface DetailRowProps {
  label: string;
  value: string;
  divider?: boolean;
}

export default function DetailRow({ label, value, divider = false }: DetailRowProps): JSX.Element {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between',
        divider && 'border-border/40 border-b pb-4',
      )}
    >
      <Text variant="muted" className="text-base">
        {label}
      </Text>
      <Text className="text-lg font-bold">{value}</Text>
    </View>
  );
}
