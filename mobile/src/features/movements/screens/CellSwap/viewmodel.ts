import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { movementsApi } from '@/features/movements/api';
import { toast } from '@/lib/toast';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'CellSwap'>;
type Route = NativeStackScreenProps<RootStackParamList, 'CellSwap'>['route'];

export function useCellSwapViewModel(navigation: Navigation, route: Route) {
  const { inmate, cellId, galleryId } = route.params;
  const queryClient = useQueryClient();

  const [destinationCellId, setDestinationCellId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId),
  });
  // Permuta troca com quem já ocupa a cela — só fazem sentido celas com
  // ao menos um preso (o backend confirma isso de novo no POST, FR-015a).
  const availableCells = (cellsQuery.data?.data ?? []).filter(
    (cell) => cell.id !== cellId && cell.occupancy > 0,
  );

  const occupantQuery = useQuery({
    queryKey: ['cell-occupant', destinationCellId],
    queryFn: () => movementsApi.cellOccupant(destinationCellId as number),
    enabled: destinationCellId !== null,
  });

  const canSubmit =
    destinationCellId !== null &&
    reason.trim() !== '' &&
    occupantQuery.data !== undefined &&
    occupantQuery.data !== null;

  async function handleConfirm(): Promise<void> {
    if (!canSubmit) return;
    setConfirmingSubmit(false);
    setSubmitting(true);
    try {
      await movementsApi.cellSwap({
        inmateId: inmate.id,
        destinationCellId: destinationCellId as number,
        reason,
        notes: notes || undefined,
      });
      toast.success(`Permuta de cela de ${inmate.name.toUpperCase()} registrada.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inmates', cellId] }),
        queryClient.invalidateQueries({ queryKey: ['inmate', inmate.id] }),
      ]);
      navigation.pop(2);
    } catch {
      toast.error('Não foi possível registrar a permuta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return {
    inmate,
    cells: availableCells,
    isLoading: cellsQuery.isLoading,
    destinationCellId,
    setDestinationCellId,
    occupant: occupantQuery.data,
    isLoadingOccupant: occupantQuery.isLoading,
    reason,
    setReason,
    notes,
    setNotes,
    submitting,
    canSubmit,
    confirmingSubmit,
    requestSubmit: () => setConfirmingSubmit(true),
    cancelSubmit: () => setConfirmingSubmit(false),
    handleConfirm,
  };
}
