import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, UserRound } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import ScreenHeader from '@/components/ScreenHeader';
import ConfirmSheet from '@/components/ConfirmSheet';
import { movementTypeIcon } from '@/features/movements/model';
import ConfirmMovementSheet from './components/ConfirmMovementSheet';
import MovementTypeOption from './components/MovementTypeOption';
import { useMovementRegisterViewModel } from './viewmodel';

type Props = NativeStackScreenProps<RootStackParamList, 'MovementRegister'>;

export default function MovementRegister({ route, navigation }: Props): JSX.Element {
  const viewModel = useMovementRegisterViewModel(navigation, route);

  /**
   * Trava a altura do conteúdo na medida inicial (antes do teclado abrir) —
   * só nesta tela e só enquanto o campo de busca está focado — pra o Android
   * não redimensionar/empurrar o rodapé pra cima (o teclado cobre a lista em
   * vez de espremer tudo). Nos campos "Local de destino"/"Observações" o
   * comportamento padrão (empurrar) continua, pra eles ficarem visíveis
   * acima do teclado.
   */
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const freezeHeight = searchFocused && contentHeight !== null;

  return (
    <SafeAreaView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={viewModel.isReturning ? 'Registrar Retorno' : 'Registrar Saída'} />

      <View
        className={freezeHeight ? undefined : 'flex-1'}
        style={freezeHeight ? { height: contentHeight } : undefined}
        onLayout={(event) => {
          if (contentHeight === null) setContentHeight(event.nativeEvent.layout.height);
        }}
      >
        <View className="gap-6 p-4">
          <View className="bg-secondary flex-row items-center gap-4 rounded-2xl p-6">
            <View className="bg-card h-14 w-14 items-center justify-center rounded-full">
              <Icon as={UserRound} size={24} color={colors.primary} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-lg font-bold uppercase">{viewModel.inmate.name}</Text>
              <Text variant="muted" className="text-base">
                Prontuário: {viewModel.inmate.registrationNumber ?? 'não informado'}
              </Text>
            </View>
          </View>
        </View>

        {viewModel.isReturning && viewModel.inmate.currentMovement ? (
          <View className="gap-3 px-4">
            <Text variant="muted" className="text-sm font-bold uppercase">
              Movimentação atual
            </Text>
            <View className="bg-secondary gap-4 rounded-2xl p-4">
              <View className="flex-row items-center justify-between">
                <Text variant="muted" className="text-sm">
                  Tipo de movimentação
                </Text>
                <Text className="font-bold">{viewModel.inmate.currentMovement.movementTypeName}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text variant="muted" className="text-sm">
                  Saída registrada em
                </Text>
                <Text className="font-bold">
                  {new Date(viewModel.inmate.currentMovement.exitDateTime).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            <Text variant="muted" className="px-4 pb-3 text-sm font-bold uppercase">
              Tipo de movimentação
            </Text>

            <View className="px-4 pb-3">
              <View className="relative justify-center">
                <View className="absolute left-4 z-10">
                  <Icon as={Search} size={18} color={colors.mutedForeground} />
                </View>
                <Input
                  value={viewModel.search}
                  onChangeText={viewModel.setSearch}
                  placeholder="Buscar motivo..."
                  className="bg-secondary rounded-full border-0 pl-12"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </View>
            </View>

            {viewModel.isLoadingTypes ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                className="flex-1"
                data={viewModel.temporaryTypes}
                keyExtractor={(type) => String(type.id)}
                contentContainerClassName="gap-3 px-4 pb-3 pt-3"
                renderItem={({ item: type }) => (
                  <MovementTypeOption
                    icon={movementTypeIcon(type.name)}
                    label={type.name}
                    selected={viewModel.movementTypeId === type.id}
                    onPress={() => viewModel.setMovementTypeId(type.id)}
                  />
                )}
                ListEmptyComponent={
                  <View className="p-4">
                    <Text variant="muted" className="text-center">
                      {viewModel.hasAnyType
                        ? 'Nenhum motivo encontrado para essa busca.'
                        : 'Nenhum tipo de movimentação cadastrado.'}
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}

        <View className="gap-4 p-4">
          {!viewModel.isReturning && (
            <>
              <View className="gap-2">
                <Text variant="muted" className="text-sm font-bold uppercase">
                  Local de destino
                </Text>
                <Input
                  value={viewModel.destinationLocation}
                  onChangeText={viewModel.setDestinationLocation}
                  placeholder="Ex.: Hospital Municipal"
                  className="bg-card"
                />
              </View>

              <Input
                value={viewModel.reason}
                onChangeText={viewModel.setReason}
                placeholder="Observações (opcional)"
                multiline
                numberOfLines={4}
                returnKeyType="done"
                blurOnSubmit
                textAlignVertical="top"
                className="bg-card h-auto min-h-[110px] items-start rounded-2xl py-3"
              />
            </>
          )}

          <Button
            size="lg"
            className="rounded-full"
            disabled={viewModel.submitting || (!viewModel.isReturning && !viewModel.canSubmitExit)}
            onPress={viewModel.requestSubmit}
          >
            <Text className="text-primary-foreground text-lg font-bold">
              {viewModel.submitting
                ? 'Salvando...'
                : viewModel.isReturning
                  ? 'Confirmar Retorno'
                  : 'Confirmar Saída'}
            </Text>
          </Button>
        </View>
      </View>

      {viewModel.isReturning ? (
        <ConfirmSheet
          visible={viewModel.confirmingSubmit}
          title="Confirmar retorno?"
          description={`Retorno de ${viewModel.inmate.name}.`}
          confirmLabel="Confirmar"
          onConfirm={() => void viewModel.handleConfirm()}
          onCancel={viewModel.cancelSubmit}
        />
      ) : (
        <ConfirmMovementSheet
          visible={viewModel.confirmingSubmit}
          inmateName={viewModel.inmate.name}
          movementTypeName={viewModel.selectedMovementTypeName}
          destinationLocation={viewModel.destinationLocation}
          reason={viewModel.reason}
          onConfirm={() => void viewModel.handleConfirm()}
          onCancel={viewModel.cancelSubmit}
        />
      )}
    </SafeAreaView>
  );
}
