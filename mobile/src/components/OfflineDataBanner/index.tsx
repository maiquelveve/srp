import { View } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

/**
 * Aviso de que a lista mostrada é dado salvo, não a busca atual (T130,
 * research.md #55) — aparece quando uma tela já tinha dado carregado e a
 * tentativa de atualizar falhou (sem conexão, ou o servidor não respondeu),
 * pra nunca deixar a tela parecer "nenhum item" ou como se estivesse
 * atualizada quando na verdade a busca falhou.
 */
export default function OfflineDataBanner(): JSX.Element {
  return (
    <View className="border-warning bg-warning/10 mx-4 mb-2 flex-row items-center gap-3 rounded-2xl border p-4">
      <Icon as={CloudOff} size={18} color={colors.warning} />
      <Text className="text-warning flex-1 text-sm font-semibold">
        Sem conexão. Mostrando dados salvos.
      </Text>
    </View>
  );
}
