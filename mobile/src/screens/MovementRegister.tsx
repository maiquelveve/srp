import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { movementsApi } from '@/features/movements/api';
import { enqueueMovement, enqueueReturn } from '@/offline/offline-queue';
import { syncPendingMovements } from '@/offline/sync-service';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MovementRegister'>;

/**
 * Registra saída/retorno de movimentação temporária (US2, FR-008/FR-009/FR-011a).
 * Every write goes through the local SQLite queue first (`enqueueMovement`/
 * `enqueueReturn`) — never a direct API call — so the exact same code path
 * works online or offline; `syncPendingMovements()` is then kicked off
 * immediately as a best-effort attempt (it succeeds right away when online,
 * or simply leaves the item queued for `startOfflineSyncListener` to pick up
 * on reconnect when it doesn't).
 */
export default function MovementRegister({ route, navigation }: Props): JSX.Element {
  const { inmate, cellId } = route.params;
  const isReturning = inmate.inMovement;

  const [movementTypeId, setMovementTypeId] = useState<number | null>(null);
  const [destinationLocation, setDestinationLocation] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const movementTypesQuery = useQuery({
    queryKey: ['movement-types'],
    queryFn: movementsApi.listTypesWithOfflineCache,
    enabled: !isReturning,
  });
  const temporaryTypes = (movementTypesQuery.data ?? []).filter((t) => t.category === 'TEMPORARY');

  const canSubmitExit = movementTypeId !== null && destinationLocation.trim() !== '';

  async function handleRegisterExit(): Promise<void> {
    if (!canSubmitExit) return;
    setSubmitting(true);
    try {
      await enqueueMovement({
        inmateId: inmate.id,
        movementTypeId: movementTypeId as number,
        originCellId: cellId,
        destinationLocation,
        reason: reason || undefined,
      });
      void syncPendingMovements();
      Alert.alert('Saída registrada', `Saída de ${inmate.name} registrada — pendente de sincronização.`);
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterReturn(): Promise<void> {
    if (!inmate.currentMovement) return;
    setSubmitting(true);
    try {
      await enqueueReturn(inmate.currentMovement.movementId);
      void syncPendingMovements();
      Alert.alert('Retorno registrado', `Retorno de ${inmate.name} registrado — pendente de sincronização.`);
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isReturning ? 'Registrar retorno' : 'Registrar saída'}</Text>

      <Text style={styles.label}>Preso</Text>
      <Text style={styles.readOnlyValue}>{inmate.name}</Text>

      {isReturning && inmate.currentMovement ? (
        <>
          <Text style={styles.label}>Tipo de movimentação</Text>
          <Text style={styles.readOnlyValue}>{inmate.currentMovement.movementTypeName}</Text>

          <Text style={styles.label}>Saída registrada em</Text>
          <Text style={styles.readOnlyValue}>
            {new Date(inmate.currentMovement.exitDateTime).toLocaleString('pt-BR')}
          </Text>

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            disabled={submitting}
            onPress={() => void handleRegisterReturn()}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Salvando...' : 'Confirmar retorno'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>Tipo de movimentação</Text>
          {temporaryTypes.map((type) => (
            <Pressable
              key={type.id}
              style={[styles.typeOption, movementTypeId === type.id && styles.typeOptionSelected]}
              onPress={() => setMovementTypeId(type.id)}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  movementTypeId === type.id && styles.typeOptionTextSelected,
                ]}
              >
                {type.name}
              </Text>
            </Pressable>
          ))}

          <Text style={styles.label}>Local de destino</Text>
          <TextInput
            style={styles.input}
            value={destinationLocation}
            onChangeText={setDestinationLocation}
          />

          <Text style={styles.label}>Motivo</Text>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} />

          <Pressable
            style={[styles.submitButton, (submitting || !canSubmitExit) && styles.submitButtonDisabled]}
            disabled={submitting || !canSubmitExit}
            onPress={() => void handleRegisterExit()}
          >
            <Text style={styles.submitButtonText}>{submitting ? 'Salvando...' : 'Registrar saída'}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 4 },
  readOnlyValue: {
    fontSize: 15,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  input: {
    fontSize: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  typeOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 8,
  },
  typeOptionSelected: { borderColor: '#0f172a', backgroundColor: '#0f172a' },
  typeOptionText: { fontSize: 15, color: '#0f172a' },
  typeOptionTextSelected: { color: '#fff' },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
