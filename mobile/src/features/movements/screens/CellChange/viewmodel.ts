import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { movementsApi } from '@/features/movements/api';
import { toast } from '@/lib/toast';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'CellChange'>;
type Route = NativeStackScreenProps<RootStackParamList, 'CellChange'>['route'];

export type CellChangeStep = 1 | 2 | 3;

/** Fluxo em passos (1 cela → 2 motivo/observações → 3 revisão) — mesmo padrão da Permuta de Cela. */
export function useCellChangeViewModel(navigation: Navigation, route: Route) {
  const { inmate, cellId, cellCode, galleryId } = route.params;
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CellChangeStep>(1);
  const [destinationCellId, setDestinationCellId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId),
  });
  const availableCells = (cellsQuery.data?.data ?? []).filter(
    (cell) => cell.id !== cellId && cell.occupancy < cell.capacity,
  );
  const selectedCell = availableCells.find((cell) => cell.id === destinationCellId);

  const canProceedStep1 = destinationCellId !== null;
  const canProceedStep2 = reason.trim() !== '';
  const canSubmit = canProceedStep1 && canProceedStep2;

  function goNext(): void {
    if (step === 1 && canProceedStep1) setStep(2);
    else if (step === 2 && canProceedStep2) setStep(3);
  }

  /** `false` quando o passo 1 é o próprio primeiro passo do fluxo — indica que "voltar" deve sair da tela. */
  function goBack(): boolean {
    if (step === 1) return false;
    setStep((current) => (current - 1) as CellChangeStep);
    return true;
  }

  async function handleConfirm(): Promise<void> {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await movementsApi.cellChange({
        inmateId: inmate.id,
        destinationCellId: destinationCellId as number,
        reason,
        notes: notes || undefined,
      });
      toast.success(`${inmate.name.toUpperCase()} trocou de cela.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inmates', cellId] }),
        queryClient.invalidateQueries({ queryKey: ['inmate', inmate.id] }),
      ]);
      navigation.pop(2);
    } catch {
      toast.error('Não foi possível registrar a troca de cela. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return {
    inmate,
    originCellCode: cellCode,
    step,
    goNext,
    goBack,
    cells: availableCells,
    isLoading: cellsQuery.isLoading,
    selectedCell,
    destinationCellId,
    setDestinationCellId,
    reason,
    setReason,
    notes,
    setNotes,
    submitting,
    canProceedStep1,
    canProceedStep2,
    canSubmit,
    handleConfirm,
  };
}
