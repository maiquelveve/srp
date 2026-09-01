import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ScreenHeader from '@/components/ScreenHeader';
import ConfirmSheet from '@/components/ConfirmSheet';
import CellOption from './components/CellOption';
import InmateOption from './components/InmateOption';
import { useCellSwapViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'CellSwap'>;

/** Permuta de cela — mesma galeria, dois presos trocam simultaneamente, nunca exige vaga (US3, FR-015a). */
export default function CellSwap({ navigation, route }: Props): JSX.Element {
  const viewModel = useCellSwapViewModel(navigation, route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Permuta de Cela" />

      <Text variant="muted" className="px-4 pb-3 pt-6 text-sm font-bold uppercase">
        Cela do outro preso
      </Text>

      {viewModel.isLoading ? (
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
      )}

      {viewModel.destinationCellId !== null && (
        <View className="gap-3 px-4 pb-2 pt-3">
          <Text variant="muted" className="text-sm font-bold uppercase">
            Preso de destino
          </Text>
          {viewModel.isLoadingCandidates ? (
            <Text variant="muted" className="text-sm">
              Consultando ocupantes...
            </Text>
          ) : viewModel.candidates.length === 0 ? (
            <Text variant="muted" className="text-sm">
              Essa cela não está mais ocupada — escolha outra.
            </Text>
          ) : (
            <View className="gap-2">
              {viewModel.candidates.map((candidate) => (
                <InmateOption
                  key={candidate.id}
                  name={candidate.name}
                  inMovement={candidate.inMovement}
                  selected={viewModel.destinationInmateId === candidate.id}
                  onPress={() => viewModel.setDestinationInmateId(candidate.id)}
                />
              ))}
              {viewModel.selectedCandidate?.inMovement && (
                <Text className="text-destructive text-sm">
                  Esse preso está em movimentação temporária. Registre o retorno antes de confirmar a
                  permuta.
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      <View className="gap-4 p-4">
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
        <Button
          size="lg"
          className="rounded-full"
          disabled={viewModel.submitting || !viewModel.canSubmit}
          onPress={viewModel.requestSubmit}
        >
          <Text className="text-primary-foreground text-lg font-bold">
            {viewModel.submitting ? 'Salvando...' : 'Confirmar Permuta'}
          </Text>
        </Button>
      </View>

      <ConfirmSheet
        visible={viewModel.confirmingSubmit}
        title="Confirmar permuta de cela?"
        description={`${viewModel.inmate.name.toUpperCase()} e ${viewModel.selectedCandidate?.name.toUpperCase() ?? 'o outro preso'} vão trocar de cela.`}
        confirmLabel="Confirmar"
        onConfirm={() => void viewModel.handleConfirm()}
        onCancel={viewModel.cancelSubmit}
      />
    </SafeAreaView>
  );
}
