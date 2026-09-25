import { weekdayLabel } from '../../labels';
import { toHHMM } from '../../time';
import type { RoutineOverlap } from '../../overlap';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Aviso de horário sobreposto (spec.md, Edge Cases): a mesma galeria já tem
 * outra rotina no mesmo horário. Não bloqueia, quem salva decide se confirma.
 */
export default function OverlapConfirmAlert({
  overlaps,
  onConfirm,
  onCancel,
}: {
  overlaps: RoutineOverlap[] | null;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <AlertDialog open={overlaps !== null} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Horário já usado nesta galeria</AlertDialogTitle>
          <AlertDialogDescription>
            Já existe outra rotina no mesmo horário. Deseja salvar mesmo assim?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(overlaps ?? []).map((overlap) => (
            <li key={`${overlap.routineId}-${overlap.weekday}-${overlap.time}`}>
              {overlap.routineName}, {weekdayLabel(overlap.weekday)} às {toHHMM(overlap.time)}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Salvar mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
