import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useLoginScreenViewModel } from './LoginScreen.viewmodel';

export default function LoginScreen(): JSX.Element {
  const vm = useLoginScreenViewModel();

  return (
    <View className="flex-1 justify-center gap-3 bg-background p-6">
      <Text variant="h3" className="mb-3 text-left">
        SRP — Entrar
      </Text>

      <View className="gap-1.5">
        <Label>E-mail</Label>
        <Input
          placeholder="E-mail"
          autoCapitalize="none"
          keyboardType="email-address"
          value={vm.email}
          onChangeText={vm.setEmail}
        />
      </View>

      <View className="gap-1.5">
        <Label>Senha</Label>
        <Input placeholder="Senha" secureTextEntry value={vm.password} onChangeText={vm.setPassword} />
      </View>

      {vm.error && (
        <Text variant="small" className="text-destructive">
          {vm.error}
        </Text>
      )}

      <Button className="mt-2" onPress={() => void vm.handleSubmit()} disabled={vm.isSubmitting}>
        {vm.isSubmitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text>Entrar</Text>}
      </Button>
    </View>
  );
}
