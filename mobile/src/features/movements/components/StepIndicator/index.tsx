import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  step: number;
  totalSteps: number;
  label: string;
}

/** Barra de progresso de um fluxo em passos (troca/permuta de cela) — segmentos preenchidos até o passo atual. */
export default function StepIndicator({ step, totalSteps, label }: StepIndicatorProps): JSX.Element {
  return (
    <View className="gap-2 px-4 pb-3 pt-2">
      <View className="flex-row gap-1.5">
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            className={cn('h-1.5 flex-1 rounded-full', index < step ? 'bg-primary' : 'bg-border')}
          />
        ))}
      </View>
      <Text variant="muted" className="text-sm font-bold uppercase">
        Passo {step} de {totalSteps} · {label}
      </Text>
    </View>
  );
}
