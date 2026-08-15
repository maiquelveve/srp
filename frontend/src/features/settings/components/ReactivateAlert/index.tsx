import type { ReactNode } from 'react';
import { isAxiosError } from 'axios';
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

type ReactivateAlertProps =
  | { entityType: 'unit'; unit: Unit; children: ReactNode }
  | { entityType: 'gallery'; unitId: number; gallery: Gallery; children: ReactNode }
  | { entityType: 'cell'; galleryId: number; cell: Cell; children: ReactNode };

function label(props: ReactivateAlertProps): string {
  if (props.entityType === 'unit') return props.unit.name;
  if (props.entityType === 'gallery') return `Galeria ${props.gallery.code}`;
  return `Cela ${props.cell.code}`;
}

/**
 * Row-level counterpart to `DeactivateAlert`, shown instead of it once a row
 * is already inactive — otherwise there was no way back to `active: true`
 * short of opening `EntityDialog`'s edit form (only Unit exposes a
 * reactivate control there). Confirmed via `AlertDialog` same as
 * deactivating, for symmetry — the styling (green) signals it's the
 * opposite, non-destructive action, not a synonym for "delete".
 */
export default function ReactivateAlert(props: ReactivateAlertProps): JSX.Element {
  const { children } = props;
  const queryClient = useQueryClient();

  const mutation = useMutation<Unit | Gallery | Cell, unknown, void>({
    mutationFn: () => {
      if (props.entityType === 'unit') return structureApi.updateUnit(props.unit.id, { active: true });
      if (props.entityType === 'gallery')
        return structureApi.updateGallery(props.gallery.id, { active: true });
      return structureApi.updateCell(props.cell.id, { active: true });
    },
    onSuccess: () => {
      notify({ message: `${label(props)} reativado`, type: 'success' });
      if (props.entityType === 'unit') void queryClient.invalidateQueries({ queryKey: ['units'] });
      if (props.entityType === 'gallery')
        void queryClient.invalidateQueries({ queryKey: ['galleries', props.unitId] });
      if (props.entityType === 'cell')
        void queryClient.invalidateQueries({ queryKey: ['cells', props.galleryId] });
    },
    onError: (error) => {
      // The Reativar button is disabled whenever the parent Galeria/Unidade
      // is inactive (SettingsPage), so this 409 should be rare in normal
      // use — but the backend enforces it independently either way
      // (Constitution IV), so surface its specific message here too instead
      // of a generic one that wouldn't explain what to do next.
      const backendMessage =
        isAxiosError<{ message?: string }>(error) && error.response?.status === 409
          ? error.response.data?.message
          : undefined;
      notify({
        title: 'Não foi possível reativar',
        message: backendMessage ?? 'Tente novamente',
        type: 'error',
      });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reativar {label(props)}?</AlertDialogTitle>
          <AlertDialogDescription>
            O registro volta a aparecer como ativo em todas as telas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              buttonVariants({ variant: 'default' }),
              // Same hue/saturation as the --success token (the "Ativo"
              // badge, the Reativar icon), just darker — the token's own
              // lightness read as too bright/pale for a solid confirm button.
              'bg-[hsl(142_71%_24%)] text-success-foreground hover:bg-[hsl(142_71%_18%)]',
            )}
            onClick={() => mutation.mutate()}
          >
            Reativar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
