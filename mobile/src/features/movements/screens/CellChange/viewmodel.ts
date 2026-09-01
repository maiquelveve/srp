import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { movementsApi } from '@/features/movements/api';
import { toast } from '@/lib/toast';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'CellChange'>;
type Route = NativeStackScreenProps<RootStackParamList, 'CellChange'>['route'];

export function useCellChangeViewModel(navigation: Navigation, route: Route) {
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
  const availableCells = (cellsQuery.data?.data ?? []).filter(
    (cell) => cell.id !== cellId && cell.occupancy < cell.capacity,
  );

  const canSubmit = destinationCellId !== null && reason.trim() !== '';

  async function handleConfirm(): Promise<void> {
    if (!canSubmit) return;
    setConfirmingSubmit(false);
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
    cells: availableCells,
    isLoading: cellsQuery.isLoading,
    destinationCellId,
    setDestinationCellId,
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
