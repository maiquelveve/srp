import type { ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { routinesApi } from '../../api';
import type { Routine } from '../../types';
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

/**
 * Diferente de Unidade/Galeria/Cela (soft `active: false`), Rotina é
 * removida de fato — `DELETE /routines/:id` (WARDEN, `409` se `locked`,
 * contracts/routines.md) não tem um estado "inativo" persistente.
 */
export default function DeleteRoutineAlert({
  routine,
  galleryId,
  children,
}: {
  routine: Routine;
  galleryId: number;
  children: ReactNode;
}): JSX.Element {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => routinesApi.remove(routine.id),
    onSuccess: () => {
      notify({ message: `Rotina "${routine.name}" excluída`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['routines', galleryId] });
    },
    onError: (error) => {
      const backendMessage =
        isAxiosError<{ message?: string }>(error) && error.response?.status === 409
          ? error.response.data?.message
          : undefined;
      notify({
        title: 'Não foi possível excluir',
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
          <AlertDialogTitle>Excluir "{routine.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. A rotina e seus horários são removidos definitivamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={() => mutation.mutate()}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
