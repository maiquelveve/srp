import { ActivityIndicator, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  sublabel: string;
  /** Falha ao buscar o dado (T130, research.md #55) — sem isso, "-" (unidade não selecionada) e falha de carga pareciam a mesma coisa. */
  isLoading?: boolean;
  isError?: boolean;
}

export default function StatCard({
  icon,
  value,
  label,
  sublabel,
  isLoading = false,
  isError = false,
}: StatCardProps): JSX.Element {
  return (
    <View className="bg-card border-border flex-1 items-center gap-2 rounded-2xl border p-3">
      <Icon as={icon} size={18} color={colors.primary} />
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : isError ? (
        <Text className="text-destructive text-sm font-bold">Erro</Text>
      ) : (
        <Text className="text-xl font-bold">{value}</Text>
      )}
      <View className="items-center">
        <Text className="text-xs font-semibold">{label}</Text>
        <Text variant="muted" className="text-xs">
          {sublabel}
        </Text>
      </View>
    </View>
  );
}
