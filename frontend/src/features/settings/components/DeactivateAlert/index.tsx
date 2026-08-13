import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { structureApi } from '@/features/structure/api';
import type { Cell, Gallery, Unit } from '@/features/structure/types';
import { notify } from '@/lib/notify';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DeactivateAlertProps =
  | { entityType: 'unit'; unit: Unit; children: ReactNode }
  | { entityType: 'gallery'; unitId: number; gallery: Gallery; children: ReactNode }
  | { entityType: 'cell'; galleryId: number; cell: Cell; children: ReactNode };

function label(props: DeactivateAlertProps): string {
  if (props.entityType === 'unit') return props.unit.name;
  if (props.entityType === 'gallery') return `Galeria ${props.gallery.code}`;
  return `Cela ${props.cell.code}`;
}

/**
 * "Excluir" is a soft deactivation everywhere (`active: false`), never a
 * hard DELETE — Unit → Gallery → Cell → Inmate all chain off each other and
 * off the audit log, so removing a row outright would orphan history
 * (mirrors the existing `PATCH /users/:id/deactivate` pattern). Galeria/Cela
 * deactivation is a client-side mock for the same reason as `EntityDialog`'s
 * edit path — no `PATCH /galleries/:id` or `/cells/:id` yet.
 */
export default function DeactivateAlert(props: DeactivateAlertProps): JSX.Element {
  const { entityType, children } = props;
  const queryClient = useQueryClient();
  const isMock = entityType !== 'unit';

  const mutation = useMutation<Unit | Gallery | Cell, unknown, void>({
    mutationFn: () => {
      if (props.entityType === 'unit') return structureApi.updateUnit(props.unit.id, { active: false });
      if (props.entityType === 'gallery')
        return structureApi.updateGalleryMock(props.gallery, { active: false });
      return structureApi.updateCellMock(props.cell, { active: false });
    },
    onSuccess: () => {
      notify({
        message: `${label(props)} desativado${isMock ? ' (simulado — backend ainda não implementado)' : ''}`,
        type: isMock ? 'info' : 'success',
      });
      if (props.entityType === 'unit') void queryClient.invalidateQueries({ queryKey: ['units'] });
    },
    onError: () => notify({ title: 'Não foi possível desativar', message: 'Tente novamente', type: 'error' }),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar {label(props)}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação pode ser revertida depois. O registro deixa de aparecer como ativo, mas nada é apagado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={() => mutation.mutate()}
          >
            Desativar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
