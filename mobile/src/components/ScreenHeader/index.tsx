import { View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { colors } from '@/theme/colors';

interface ScreenHeaderProps {
  title: string;
}

/**
 * Header padrão de toda tela que não seja raiz de navegação (Home) — botão
 * circular dourado de voltar + título, mesmo padrão em todas as telas pra
 * eliminar a confusão de "em qual tela estou / pra onde volto".
 */
export default function ScreenHeader({ title }: ScreenHeaderProps): JSX.Element {
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();

  return (
    <View className="border-border flex-row items-center gap-3 border-b p-4">
      {canGoBack && (
        <Pressable
          onPress={() => navigation.goBack()}
          className="h-9 w-9 items-center justify-center rounded-full bg-primary"
        >
          <Icon as={ChevronLeft} size={20} color={colors.primaryForeground} />
        </Pressable>
      )}
      <Text variant="h4" className="flex-1 text-left" numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
    </View>
  );
}
