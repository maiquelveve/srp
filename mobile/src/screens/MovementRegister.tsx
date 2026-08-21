import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ScreenHeader from '@/components/ScreenHeader';
import ConfirmSheet from '@/components/ConfirmSheet';
import { useMovementRegisterViewModel } from './MovementRegister.viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'MovementRegister'>;

export default function MovementRegister({ route, navigation }: Props): JSX.Element {
  const vm = useMovementRegisterViewModel(navigation, route);

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1" edges={['top', 'left', 'right']}>
      <ScreenHeader title={vm.isReturning ? 'Registrar retorno' : 'Registrar saída'} />

      <ScrollView contentContainerClassName="p-4">
        <FieldLabel>Preso</FieldLabel>
        <ReadOnlyValue>{vm.inmate.name}</ReadOnlyValue>

        {vm.isReturning && vm.inmate.currentMovement ? (
          <>
            <FieldLabel>Tipo de movimentação</FieldLabel>
            <ReadOnlyValue>{vm.inmate.currentMovement.movementTypeName}</ReadOnlyValue>

            <FieldLabel>Saída registrada em</FieldLabel>
            <ReadOnlyValue>{new Date(vm.inmate.currentMovement.exitDateTime).toLocaleString('pt-BR')}</ReadOnlyValue>

            <Button className="mt-6" disabled={vm.submitting} onPress={vm.requestSubmit}>
              <Text>{vm.submitting ? 'Salvando...' : 'Confirmar retorno'}</Text>
            </Button>
          </>
        ) : (
          <>
            <FieldLabel>Tipo de movimentação</FieldLabel>
            {vm.temporaryTypes.map((type) => (
              <Pressable
                key={type.id}
                className={
                  vm.movementTypeId === type.id
                    ? 'border-primary bg-primary mb-2 rounded-md border p-3'
                    : 'border-border mb-2 rounded-md border p-3'
                }
                onPress={() => vm.setMovementTypeId(type.id)}
              >
                <Text className={vm.movementTypeId === type.id ? 'text-primary-foreground' : undefined}>
                  {type.name}
                </Text>
              </Pressable>
            ))}

            <FieldLabel>Local de destino</FieldLabel>
            <Input value={vm.destinationLocation} onChangeText={vm.setDestinationLocation} />

            <FieldLabel>Motivo</FieldLabel>
            <Input value={vm.reason} onChangeText={vm.setReason} />

            <Button className="mt-6" disabled={vm.submitting || !vm.canSubmitExit} onPress={vm.requestSubmit}>
              <Text>{vm.submitting ? 'Salvando...' : 'Registrar saída'}</Text>
            </Button>
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={vm.confirmingSubmit}
        title={vm.isReturning ? 'Confirmar retorno?' : 'Confirmar saída?'}
        description={`${vm.isReturning ? 'Retorno' : 'Saída'} de ${vm.inmate.name}.`}
        confirmLabel="Confirmar"
        onConfirm={() => void vm.handleConfirm()}
        onCancel={vm.cancelSubmit}
      />
    </SafeAreaView>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Text variant="muted" className="mb-1 mt-3 text-xs">
      {children}
    </Text>
  );
}

function ReadOnlyValue({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <View className="bg-muted rounded-md p-3">
      <Text>{children}</Text>
    </View>
  );
}
