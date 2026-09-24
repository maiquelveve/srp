import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PowerIcon, PowerOffIcon } from 'lucide-react';
import { staffApi } from '../../api';
import type { Post } from '../../types';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
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
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * Desativa (com confirmação) ou reativa (direto) um posto (WARDEN, FR-022a).
 * Desativar não apaga nada: o posto só deixa de aceitar novas escalas e de
 * contar no efetivo mínimo; as escalas já cadastradas continuam no histórico.
 */
export default function PostStatusButton({ post }: { post: Post }): JSX.Element {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (active: boolean) => staffApi.updatePost(post.id, { active }),
    onSuccess: (_updated, active) => {
      notify({
        message: active ? `Posto "${post.name}" reativado` : `Posto "${post.name}" desativado`,
        type: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      void queryClient.invalidateQueries({ queryKey: ['minimum-staffing'] });
    },
    onError: () =>
      notify({ title: 'Não foi possível salvar', message: 'Tente novamente', type: 'error' }),
  });

  if (!post.active) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(true)}
      >
        <PowerIcon className="size-3.5" />
        <span className="sr-only">Reativar</span>
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <PowerOffIcon className="size-3.5" />
          <span className="sr-only">Desativar</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar "{post.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            O posto deixa de aparecer para novas escalas e de contar no efetivo mínimo. As escalas
            já cadastradas são mantidas e o posto pode ser reativado depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={() => mutation.mutate(false)}
          >
            Desativar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
