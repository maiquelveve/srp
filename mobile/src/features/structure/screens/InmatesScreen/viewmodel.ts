import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import {
  countedMovementsLabel,
  filterInmatesBySearch,
  inmateMovementActionLabel,
  inmateStatusLine,
} from '@/features/structure/model';
import type { Inmate } from '@/features/structure/types';
import type { RootStackParamList } from '@/navigation/types';
import { countPending } from '@/offline/offline-queue';
import { syncPendingMovements } from '@/offline/sync-service';
import { toast } from '@/lib/toast';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Inmates'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Inmates'>['route'];

export function useInmatesScreenViewModel(navigation: Navigation, route: Route) {
  const { cellId, cellCode, capacity, occupancy, galleryId, galleryCode } = route.params;
  const queryClient = useQueryClient();

  const inmatesQuery = useQuery({
    queryKey: ['inmates', cellId],
    queryFn: () => structureApi.listInmates(cellId),
  });

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  // Sem isso, voltar pra cá depois de registrar uma troca/permuta/movimentação
  // (telas empilhadas em cima, nunca desmontadas pelo native-stack) mostrava
  // a lista desatualizada até o usuário sair e entrar de novo na tela — o
  // `invalidateQueries` que cada fluxo já dispara no próprio `handleConfirm`
  // não é suficiente sozinho (a tela pode não estar "ativa" o bastante pro
  // React Query refazer o fetch antes da navegação de volta completar).
  // Refazer aqui, a cada foco, garante dado fresco sempre que a tela reaparece.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['inmates', cellId] });
      countPending().then(setPendingSyncCount);
    }, [queryClient, cellId]),
  );

  function goToDetail(inmateId: number): void {
    navigation.navigate('InmateDetail', { inmateId, cellCode, galleryCode });
  }

  function goToMovementRegister(inmate: Inmate): void {
    navigation.navigate('MovementRegister', { inmate, cellId });
  }

  function goToCellTransferSelect(inmate: Inmate): void {
    // Preso fora da cela numa movimentação temporária em aberto (atendimento
    // médico, audiência etc.) — o backend já recusa qualquer troca/permuta
    // nesse estado (409), isso só evita abrir a tela pra descobrir só no
    // final. Sem tooltip no mobile (não existe esse componente aqui, ver
    // docs/style-guide.md #6), então o aviso vem por toast no toque.
    if (inmate.inMovement) {
      toast.warning('Preso em movimentação temporária. Registre o retorno antes de continuar.');
      return;
    }
    navigation.navigate('CellTransferSelect', { inmate, cellId, cellCode, galleryId, galleryCode });
  }

  // Botão manual de sincronização (pedido do usuário no QA de 2026-09-24) —
  // a fila já sincroniza sozinha ao reconectar e no boot do app
  // (startOfflineSyncListener, App.tsx), mas isso depende do listener do
  // NetInfo disparar; esse botão dá um jeito confiável de forçar a tentativa
  // na hora, sem esperar o próximo evento de conectividade.
  async function forceSync(): Promise<void> {
    setSyncing(true);
    try {
      const pendingBefore = await countPending();
      const result = await syncPendingMovements();
      const totalSynced = result.syncedMovements + result.syncedReturns;
      const synced = countedMovementsLabel(totalSynced, 'sincronizada', 'sincronizadas');
      const rejectedAdjective = result.rejected === 1 ? 'recusada' : 'recusadas';

      if (totalSynced > 0 && result.rejected === 0) {
        toast.success(`${synced}.`);
      } else if (totalSynced > 0 && result.rejected > 0) {
        toast.warning(`${synced}, ${result.rejected} ${rejectedAdjective} pelo servidor.`);
      } else if (result.rejected > 0) {
        toast.warning(`${countedMovementsLabel(result.rejected, 'recusada', 'recusadas')} pelo servidor. Consulte a supervisão.`);
      } else if (pendingBefore > 0) {
        toast.error('Não foi possível sincronizar. Verifique a conexão e tente novamente.');
      } else {
        toast.info('Nenhuma movimentação pendente de sincronização.');
      }

      await queryClient.invalidateQueries({ queryKey: ['inmates', cellId] });
      setPendingSyncCount(await countPending());
    } finally {
      setSyncing(false);
    }
  }

  return {
    title: `Galeria ${galleryCode}   /   Cela ${cellCode}`.toUpperCase(),
    dateLabel: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    // `occupancy` do route.params fica congelado no valor de quando a tela
    // foi empilhada (native-stack não a desmonta ao voltar de uma troca) —
    // usa a contagem viva de `inmatesQuery` (já filtrada por ACTIVE, mesmo
    // critério do `CellsService.occupancyOf` do backend) e só cai pro param
    // como valor inicial antes da primeira resposta chegar.
    occupancyLabel: `${inmatesQuery.data?.total ?? occupancy}/${capacity} presos`,
    inmates: filterInmatesBySearch(inmatesQuery.data?.data ?? [], search),
    hasAnyInmate: (inmatesQuery.data?.data.length ?? 0) > 0,
    isLoading: inmatesQuery.isLoading,
    search,
    setSearch,
    pendingSyncCount,
    syncing,
    forceSync,
    statusLine: inmateStatusLine,
    movementActionLabel: inmateMovementActionLabel,
    goToDetail,
    goToMovementRegister,
    goToCellTransferSelect,
  };
}
