import { useCallback } from 'react';
import { ActivityIndicator, BackHandler, FlatList, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ScreenHeader from '@/components/ScreenHeader';
import StepIndicator from '@/features/movements/components/StepIndicator';
import CellOption from './components/CellOption';
import { useCellChangeViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'CellChange'>;

const STEP_LABEL = {
  1: 'Cela de destino',
  2: 'Motivo e observações',
  3: 'Revisar e confirmar',
} as const;

/**
 * Troca de cela — mesma galeria, exige vaga na cela de destino (US3,
 * FR-015). Fluxo em 3 passos (cela → motivo → revisão), mesmo padrão da
 * Permuta de Cela (`CellSwap`) — um passo por tela, sem listas e campos
 * competindo por espaço nem com o teclado.
 */
export default function CellChange({ navigation, route }: Props): JSX.Element {
  const viewModel = useCellChangeViewModel(navigation, route);

  function handleBackPress(): void {
    if (!viewModel.goBack()) navigation.goBack();
  }

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (viewModel.step === 1) return false;
        viewModel.goBack();
        return true;
      });
      return () => subscription.remove();
    }, [viewModel.step]),
  );

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Troca de Cela" onBackPress={handleBackPress} />

      <View className="gap-1 px-4 pb-2 pt-6">
        <Text variant="muted" className="text-sm font-bold uppercase">
          Preso · Cela atual
        </Text>
        <Text className="text-lg font-bold uppercase">
          {viewModel.inmate.name} · Cela {viewModel.originCellCode}
        </Text>
      </View>
      <StepIndicator step={viewModel.step} totalSteps={3} label={STEP_LABEL[viewModel.step]} />

      {viewModel.step === 1 &&
        (viewModel.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            className="flex-1"
            data={viewModel.cells}
            keyExtractor={(cell) => String(cell.id)}
            contentContainerClassName="gap-3 px-4"
            renderItem={({ item: cell }) => (
              <CellOption
                code={cell.code}
                capacity={cell.capacity}
                occupancy={cell.occupancy}
                selected={viewModel.destinationCellId === cell.id}
                onPress={() => viewModel.setDestinationCellId(cell.id)}
              />
            )}
            ListEmptyComponent={
              <View className="p-4">
                <Text variant="muted" className="text-center">
                  Nenhuma cela com vaga nesta galeria.
                </Text>
              </View>
            }
          />
        ))}

      {viewModel.step === 2 && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
            <Input
              value={viewModel.reason}
              onChangeText={viewModel.setReason}
              placeholder="Motivo"
              className="bg-card"
            />
            <Input
              value={viewModel.notes}
              onChangeText={viewModel.setNotes}
              placeholder="Observações (opcional)"
              className="bg-card"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {viewModel.step === 3 && (
        <ScrollView contentContainerClassName="p-4">
          <View className="bg-secondary gap-4 rounded-2xl p-4">
            <View className="gap-1">
              <Text variant="muted" className="text-sm font-bold uppercase">
                Preso
              </Text>
              <Text className="text-base font-bold uppercase">{viewModel.inmate.name}</Text>
            </View>
            <View className="gap-1">
              <Text variant="muted" className="text-sm font-bold uppercase">
                Nova cela
              </Text>
              <Text className="text-base font-bold">
                {viewModel.selectedCell ? `Cela ${viewModel.selectedCell.code}` : 'Nenhuma cela selecionada'}
              </Text>
            </View>
            <View className="gap-1">
              <Text variant="muted" className="text-sm font-bold uppercase">
                Motivo
              </Text>
              <Text className="text-base">{viewModel.reason}</Text>
            </View>
            <View className="gap-1">
              <Text variant="muted" className="text-sm font-bold uppercase">
                Observações
              </Text>
              <Text className="text-base">{viewModel.notes || 'Sem observações'}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <View className="flex-row gap-3 p-4">
        {viewModel.step > 1 && (
          <Button variant="outline" size="lg" className="flex-1 rounded-full" onPress={handleBackPress}>
            <Text className="text-base font-bold">Voltar</Text>
          </Button>
        )}
        {viewModel.step < 3 ? (
          <Button
            size="lg"
            className="flex-1 rounded-full"
            disabled={
              (viewModel.step === 1 && !viewModel.canProceedStep1) ||
              (viewModel.step === 2 && !viewModel.canProceedStep2)
            }
            onPress={viewModel.goNext}
          >
            <Text className="text-primary-foreground text-base font-bold">Avançar</Text>
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 rounded-full"
            disabled={viewModel.submitting || !viewModel.canSubmit}
            onPress={() => void viewModel.handleConfirm()}
          >
            <Text className="text-primary-foreground text-base font-bold">
              {viewModel.submitting ? 'Salvando...' : 'Confirmar Troca'}
            </Text>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
