import { ActivityIndicator, Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLoginScreenViewModel } from './viewmodel';

export default function LoginScreen(): JSX.Element {
  const viewModel = useLoginScreenViewModel();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 justify-center gap-4 bg-background p-6">
      <View className="mb-2 items-center gap-2">
        <Image
          source={require('../../../assets/logo-pp-rs.png')}
          className="h-44 w-44"
          resizeMode="contain"
        />
        <Text className="text-center text-xl font-medium text-foreground">
          Sistema de Rotinas Penitenciárias
        </Text>
      </View>

      <View className="gap-1.5">
        <Label className="text-base font-bold">E-mail</Label>
        <Input
          placeholder="E-mail"
          autoCapitalize="none"
          keyboardType="email-address"
          value={viewModel.email}
          onChangeText={viewModel.setEmail}
          error={!!viewModel.emailError}
        />
        {viewModel.emailError && (
          <Text variant="small" className="text-destructive">
            {viewModel.emailError}
          </Text>
        )}
      </View>

      <View className="gap-1.5">
        <Label className="text-base font-bold">Senha</Label>
        <Input
          placeholder="Senha"
          secureTextEntry
          value={viewModel.password}
          onChangeText={viewModel.setPassword}
          error={!!viewModel.passwordError}
        />
        {viewModel.passwordError && (
          <Text variant="small" className="text-destructive">
            {viewModel.passwordError}
          </Text>
        )}
      </View>

      <Button
        size="lg"
        className="mt-2 w-full"
        onPress={() => void viewModel.handleSubmit()}
        disabled={viewModel.isSubmitting}
      >
        {viewModel.isSubmitting ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text className="text-lg font-bold">Entrar</Text>
        )}
      </Button>

      {viewModel.credentialsError && (
        <View className="absolute inset-x-6 items-center" style={{ bottom: insets.bottom + 24 }}>
          <Alert variant="error" className="max-w-sm">
            <Icon as={AlertCircle} size={20} className="mt-0.5" />
            <View className="flex-1">
              <AlertTitle>Credenciais inválidas</AlertTitle>
              <AlertDescription>E-mail ou senha inválido</AlertDescription>
            </View>
          </Alert>
        </View>
      )}
    </View>
  );
}
