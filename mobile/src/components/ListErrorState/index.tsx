import { View } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

interface ListErrorStateProps {
  message: string;
  onRetry: () => void;
}

/**
 * Estado de erro de verdade de uma tela de lista (T130, research.md #55) —
 * ocupa a área da lista quando a busca falhou e não há nenhum dado (nem de
 * cache) pra mostrar no lugar. Compartilhado entre `InmatesScreen`,
 * `GalleriesScreen`, `CellsScreen` e `ShiftRoutines` pra não repetir o
 * mesmo bloco em cada tela — evita que uma falha de carga vire "nenhum
 * item" (indistinguível de uma lista de verdade vazia).
 */
export default function ListErrorState({ message, onRetry }: ListErrorStateProps): JSX.Element {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-6">
      <Icon as={CloudOff} size={32} color={colors.destructive} />
      <Text variant="muted" className="text-center">
        {message}
      </Text>
      <Button variant="outline" className="border-primary bg-transparent rounded-full" onPress={onRetry}>
        <Text className="text-primary text-base font-bold">Tentar de novo</Text>
      </Button>
    </View>
  );
}
