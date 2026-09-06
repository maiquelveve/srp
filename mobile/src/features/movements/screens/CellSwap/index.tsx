import { useCallback } from 'react';
import { ActivityIndicator, BackHandler, FlatList, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import ScreenHeader from '@/components/ScreenHeader';
import StepIndicator from '@/features/movements/components/StepIndicator';
import CellOption from './components/CellOption';
import InmateOption from './components/InmateOption';
import { useCellSwapViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'CellSwap'>;

const STEP_LABEL = {
  1: 'Cela do outro preso',
  2: 'Preso de destino',
  3: 'Motivo e observações',
  4: 'Revisar e confirmar',
} as const;

/**
 * Permuta de cela — mesma galeria, dois presos trocam simultaneamente, nunca
 * exige vaga (US3, FR-015a). Fluxo em 4 passos (cela → preso → motivo →
 * revisão), um por tela: a versão anterior empilhava lista de celas + lista
 * de presos + campos de texto na mesma tela, e essas seções competiam por
 * espaço entre si e com o teclado (listas cortadas, campos cobertos). Com um
 * passo por vez, cada tela tem no máximo uma lista OU um par de campos, sem
 * disputa nenhuma — só avança quando o passo atual está válido.
 */
export default function CellSwap({ navigation, route }: Props): JSX.Element {
  const viewModel = useCellSwapViewModel(navigation, route);

  function handleBackPress(): void {
    if (!viewModel.goBack()) navigation.goBack();
  }

  // Botão físico de voltar do Android segue a mesma regra do botão do
  // cabeçalho — retrocede um passo em vez de sair do fluxo direto.
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
      <ScreenHeader title="Permuta de Cela" onBackPress={handleBackPress} />

      {/* Contexto fixo em todo passo — sem isso, o usuário perde de vista
          quem está sendo movido e de onde ao avançar pelo fluxo (o nome do
          preso só aparecia antes, na tela de seleção do tipo de troca). */}
      <View className="gap-1 px-4 pb-2 pt-6">
        <Text variant="muted" className="text-sm font-bold uppercase">
          Preso · Cela atual
        </Text>
        <Text className="text-lg font-bold uppercase">
          {viewModel.inmate.name} · Cela {viewModel.originCellCode}
        </Text>
      </View>
      <StepIndicator step={viewModel.step} totalSteps={4} label={STEP_LABEL[viewModel.step]} />

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
                  Nenhuma outra cela ocupada nesta galeria.
                </Text>
              </View>
            }
          />
        ))}

      {viewModel.step === 2 &&
        (viewModel.isLoadingCandidates ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !viewModel.hasAnyCandidate ? (
          <View className="p-4">
            <Text variant="muted" className="text-center">
              Essa cela não está mais ocupada — volte e escolha outra.
            </Text>
          </View>
        ) : (
          <>
            {viewModel.showCandidateSearch && (
              <View className="px-4 pb-3">
                <View className="relative justify-center">
                  <View className="absolute left-4 z-10">
                    <Icon as={Search} size={18} color={colors.mutedForeground} />
                  </View>
                  <Input
                    value={viewModel.candidateSearch}
                    onChangeText={viewModel.setCandidateSearch}
                    placeholder="Buscar preso..."
                    className="bg-secondary rounded-full border-0 pl-12"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            )}
            <FlatList
              className="flex-1"
              data={viewModel.candidates}
              keyExtractor={(candidate) => String(candidate.id)}
              contentContainerClassName="gap-2 px-4"
              renderItem={({ item: candidate }) => (
                <InmateOption
                  name={candidate.name}
                  inMovement={candidate.inMovement}
                  selected={viewModel.destinationInmateId === candidate.id}
                  onPress={() => viewModel.setDestinationInmateId(candidate.id)}
                />
              )}
              ListEmptyComponent={
                <Text variant="muted" className="p-2 text-sm">
                  Nenhum preso encontrado para essa busca.
                </Text>
              }
              ListFooterComponent={
                viewModel.selectedCandidate?.inMovement ? (
                  <Text className="text-destructive px-2 pt-2 text-sm">
                    Esse preso está em movimentação temporária. Registre o retorno antes de confirmar a
                    permuta.
                  </Text>
                ) : null
              }
            />
          </>
        ))}

      {viewModel.step === 3 && (
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

      {viewModel.step === 4 && (
        <ScrollView contentContainerClassName="p-4">
          <View className="bg-secondary gap-4 rounded-2xl p-4">
            <View className="gap-1">
              <Text variant="muted" className="text-sm font-bold uppercase">
                Presos envolvidos
              </Text>
              <Text className="text-base font-bold uppercase">{viewModel.inmate.name}</Text>
              <Text className="text-base font-bold uppercase">
                {viewModel.selectedCandidate?.name ?? '—'}
              </Text>
            </View>
            <View className="gap-1">
              <Text variant="muted" className="text-sm font-bold uppercase">
                Nova cela de {viewModel.inmate.name.split(' ')[0].toUpperCase()}
              </Text>
              <Text className="text-base font-bold">Cela {viewModel.selectedCell?.code ?? '—'}</Text>
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
              <Text className="text-base">{viewModel.notes || '—'}</Text>
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
        {viewModel.step < 4 ? (
          <Button
            size="lg"
            className="flex-1 rounded-full"
            disabled={
              (viewModel.step === 1 && !viewModel.canProceedStep1) ||
              (viewModel.step === 2 && !viewModel.canProceedStep2) ||
              (viewModel.step === 3 && !viewModel.canProceedStep3)
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
              {viewModel.submitting ? 'Salvando...' : 'Confirmar Permuta'}
            </Text>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
