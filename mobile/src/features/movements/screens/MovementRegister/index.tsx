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
import { useMovementRegisterViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'MovementRegister'>;

export default function MovementRegister({ route, navigation }: Props): JSX.Element {
  const viewModel = useMovementRegisterViewModel(navigation, route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={viewModel.isReturning ? 'Registrar retorno' : 'Registrar saída'} />

      <ScrollView contentContainerClassName="p-4">
        <FieldLabel>Preso</FieldLabel>
        <ReadOnlyValue>{viewModel.inmate.name}</ReadOnlyValue>

        {viewModel.isReturning && viewModel.inmate.currentMovement ? (
          <>
            <FieldLabel>Tipo de movimentação</FieldLabel>
            <ReadOnlyValue>{viewModel.inmate.currentMovement.movementTypeName}</ReadOnlyValue>

            <FieldLabel>Saída registrada em</FieldLabel>
            <ReadOnlyValue>
              {new Date(viewModel.inmate.currentMovement.exitDateTime).toLocaleString('pt-BR')}
            </ReadOnlyValue>

            <Button
              className="mt-6"
              disabled={viewModel.submitting}
              onPress={viewModel.requestSubmit}
            >
              <Text>{viewModel.submitting ? 'Salvando...' : 'Confirmar retorno'}</Text>
            </Button>
          </>
        ) : (
          <>
            <FieldLabel>Tipo de movimentação</FieldLabel>
            {viewModel.temporaryTypes.map((type) => (
              <Pressable
                key={type.id}
                className={
                  viewModel.movementTypeId === type.id
                    ? 'border-primary bg-primary mb-2 rounded-md border p-3'
                    : 'border-border mb-2 rounded-md border p-3'
                }
                onPress={() => viewModel.setMovementTypeId(type.id)}
              >
                <Text
                  className={
                    viewModel.movementTypeId === type.id ? 'text-primary-foreground' : undefined
                  }
                >
                  {type.name}
                </Text>
              </Pressable>
            ))}

            <FieldLabel>Local de destino</FieldLabel>
            <Input
              value={viewModel.destinationLocation}
              onChangeText={viewModel.setDestinationLocation}
            />

            <FieldLabel>Motivo</FieldLabel>
            <Input value={viewModel.reason} onChangeText={viewModel.setReason} />

            <Button
              className="mt-6"
              disabled={viewModel.submitting || !viewModel.canSubmitExit}
              onPress={viewModel.requestSubmit}
            >
              <Text>{viewModel.submitting ? 'Salvando...' : 'Registrar saída'}</Text>
            </Button>
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={viewModel.confirmingSubmit}
        title={viewModel.isReturning ? 'Confirmar retorno?' : 'Confirmar saída?'}
        description={`${viewModel.isReturning ? 'Retorno' : 'Saída'} de ${viewModel.inmate.name}.`}
        confirmLabel="Confirmar"
        onConfirm={() => void viewModel.handleConfirm()}
        onCancel={viewModel.cancelSubmit}
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
