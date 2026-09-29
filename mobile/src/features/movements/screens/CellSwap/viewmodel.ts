import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { movementsApi } from '@/features/movements/api';
import { normalizeForSearch } from '@/features/movements/model';
import { extractApiErrorMessage } from '@/lib/api-error';
import { toast } from '@/lib/toast';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'CellSwap'>;
type Route = NativeStackScreenProps<RootStackParamList, 'CellSwap'>['route'];

export type CellSwapStep = 1 | 2 | 3 | 4;

/**
 * Fluxo em passos (1 cela → 2 preso → 3 motivo/observações → 4 revisão) —
 * cada passo ocupa a tela inteira, então as listas e campos de texto não
 * disputam espaço nem competem com o teclado entre si (era o problema da
 * versão de tela única: listas cortadas, campo coberto pelo teclado).
 */
export function useCellSwapViewModel(navigation: Navigation, route: Route) {
  const { inmate, cellId, cellCode, galleryId } = route.params;
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CellSwapStep>(1);
  const [destinationCellId, setDestinationCellId] = useState<number | null>(null);
  const [selectedDestinationInmateId, setSelectedDestinationInmateId] = useState<number | null>(null);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId),
  });
  // Permuta troca com quem já ocupa a cela — só fazem sentido celas com
  // ao menos um preso (o backend confirma isso de novo no POST, FR-015a).
  const availableCells = (cellsQuery.data?.data ?? []).filter(
    (cell) => cell.id !== cellId && cell.occupancy > 0,
  );
  const selectedCell = availableCells.find((cell) => cell.id === destinationCellId);

  // Permuta troca com um preso específico, não "a cela" — uma cela
  // compartilhada pode ter mais de um ocupante ativo, então não dá pra
  // assumir "quem estiver lá". Lista todos os ocupantes ativos e deixa o
  // usuário escolher (research.md #36 — antes vinha um preso pré-selecionado
  // sem escolha possível, `structureApi.listInmates` já filtra ACTIVE).
  const candidatesQuery = useQuery({
    queryKey: ['inmates', destinationCellId],
    queryFn: () => structureApi.listInmates(destinationCellId as number),
    enabled: destinationCellId !== null,
  });
  const candidates = candidatesQuery.data?.data ?? [];
  // Busca por substring simples (não fuzzy) sobre o nome, ignorando acentos —
  // mesma normalização usada em `filterMovementTypesBySearch`. Cela cheia
  // pode ter muitos ocupantes (research.md #36), e rolar a lista toda pra
  // achar um nome é ruim.
  const normalizedCandidateSearch = normalizeForSearch(candidateSearch.trim());
  const filteredCandidates = normalizedCandidateSearch
    ? candidates.filter((candidate) => normalizeForSearch(candidate.name).includes(normalizedCandidateSearch))
    : candidates;
  // Só pré-seleciona quando não há ambiguidade (um único ocupante).
  const destinationInmateId =
    selectedDestinationInmateId ?? (candidates.length === 1 ? candidates[0].id : null);
  const selectedCandidate = candidates.find((candidate) => candidate.id === destinationInmateId);

  const canProceedStep1 = destinationCellId !== null;
  const canProceedStep2 =
    destinationInmateId !== null && selectedCandidate !== undefined && !selectedCandidate.inMovement;
  const canProceedStep3 = reason.trim() !== '';
  const canSubmit = canProceedStep1 && canProceedStep2 && canProceedStep3;

  function goNext(): void {
    if (step === 1 && canProceedStep1) setStep(2);
    else if (step === 2 && canProceedStep2) setStep(3);
    else if (step === 3 && canProceedStep3) setStep(4);
  }

  /** `false` quando o passo 1 é o próprio primeiro passo do fluxo — indica que "voltar" deve sair da tela. */
  function goBack(): boolean {
    if (step === 1) return false;
    setStep((current) => (current - 1) as CellSwapStep);
    return true;
  }

  async function handleConfirm(): Promise<void> {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await movementsApi.cellSwap({
        inmateId: inmate.id,
        destinationCellId: destinationCellId as number,
        destinationInmateId: destinationInmateId as number,
        reason,
        notes: notes || undefined,
      });
      toast.success(`Permuta de cela de ${inmate.name.toUpperCase()} registrada.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inmates', cellId] }),
        queryClient.invalidateQueries({ queryKey: ['inmate', inmate.id] }),
      ]);
      navigation.pop(2);
    } catch (error) {
      toast.error(extractApiErrorMessage(error, 'Não foi possível registrar a permuta. Tente novamente.'));
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
    setDestinationCellId: (id: number) => {
      setDestinationCellId(id);
      setSelectedDestinationInmateId(null);
      setCandidateSearch('');
    },
    candidates: filteredCandidates,
    hasAnyCandidate: candidates.length > 0,
    // Busca só compensa quando há mais de um ocupante pra escolher — com um
    // único candidato ele já vem pré-selecionado, sem ambiguidade nenhuma.
    showCandidateSearch: candidates.length > 1,
    isLoadingCandidates: candidatesQuery.isLoading,
    candidateSearch,
    setCandidateSearch,
    destinationInmateId,
    setDestinationInmateId: setSelectedDestinationInmateId,
    selectedCandidate,
    reason,
    setReason,
    notes,
    setNotes,
    submitting,
    canProceedStep1,
    canProceedStep2,
    canProceedStep3,
    canSubmit,
    handleConfirm,
  };
}
