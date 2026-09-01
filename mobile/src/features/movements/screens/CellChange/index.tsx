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
import { useCellChangeViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'CellChange'>;

/** Troca de cela — mesma galeria, exige vaga na cela de destino (US3, FR-015). */
export default function CellChange({ navigation, route }: Props): JSX.Element {
  const viewModel = useCellChangeViewModel(navigation, route);

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Troca de Cela" />

      <Text variant="muted" className="px-4 pb-3 pt-6 text-sm font-bold uppercase">
        Cela de destino
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
                Nenhuma cela com vaga nesta galeria.
              </Text>
            </View>
          }
        />
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
            {viewModel.submitting ? 'Salvando...' : 'Confirmar Troca'}
          </Text>
        </Button>
      </View>

      <ConfirmSheet
        visible={viewModel.confirmingSubmit}
        title="Confirmar troca de cela?"
        description={`${viewModel.inmate.name.toUpperCase()} vai mudar de cela.`}
        confirmLabel="Confirmar"
        onConfirm={() => void viewModel.handleConfirm()}
        onCancel={viewModel.cancelSubmit}
      />
    </SafeAreaView>
  );
}
