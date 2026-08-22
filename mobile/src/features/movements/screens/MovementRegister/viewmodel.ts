import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { movementsApi } from '@/features/movements/api';
import { canSubmitExitMovement, filterTemporaryMovementTypes } from '@/features/movements/model';
import { enqueueMovement, enqueueReturn } from '@/offline/offline-queue';
import { syncPendingMovements } from '@/offline/sync-service';
import { toast } from '@/lib/toast';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MovementRegister'>;

export function useMovementRegisterViewModel(
  navigation: Props['navigation'],
  route: Props['route'],
) {
  const { inmate, cellId } = route.params;
  const isReturning = inmate.inMovement;

  const [movementTypeId, setMovementTypeId] = useState<number | null>(null);
  const [destinationLocation, setDestinationLocation] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const movementTypesQuery = useQuery({
    queryKey: ['movement-types'],
    queryFn: movementsApi.listTypesWithOfflineCache,
    enabled: !isReturning,
  });
  const temporaryTypes = filterTemporaryMovementTypes(movementTypesQuery.data ?? []);

  const canSubmitExit = canSubmitExitMovement(movementTypeId, destinationLocation);

  async function handleConfirm(): Promise<void> {
    setConfirmingSubmit(false);
    setSubmitting(true);
    try {
      if (isReturning) {
        if (!inmate.currentMovement) return;
        await enqueueReturn(inmate.currentMovement.movementId);
        void syncPendingMovements();
        toast.success(`Retorno de ${inmate.name} registrado.`);
      } else {
        if (!canSubmitExit) return;
        await enqueueMovement({
          inmateId: inmate.id,
          movementTypeId: movementTypeId as number,
          originCellId: cellId,
          destinationLocation,
          reason: reason || undefined,
        });
        void syncPendingMovements();
        toast.success(`Saída de ${inmate.name} registrada.`);
      }
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  }

  return {
    inmate,
    isReturning,
    temporaryTypes,
    movementTypeId,
    setMovementTypeId,
    destinationLocation,
    setDestinationLocation,
    reason,
    setReason,
    submitting,
    canSubmitExit,
    confirmingSubmit,
    requestSubmit: () => setConfirmingSubmit(true),
    cancelSubmit: () => setConfirmingSubmit(false),
    handleConfirm,
  };
}
