import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PowerIcon, PowerOffIcon } from 'lucide-react';
import { usersApi } from '../../api';
import type { AdminUser } from '../../types';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface UserStatusButtonProps {
  user: AdminUser;
}

/**
 * Desativa (com confirmação) ou reativa (direto) um usuário — mesmo padrão
 * de PostStatusButton. Nunca é chamado sobre a própria conta: `GET /users`
 * nunca lista o requisitante (FR-008a fica só no backend, mas o cenário nem
 * aparece na UI).
 */
export default function UserStatusButton({ user }: UserStatusButtonProps): JSX.Element {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (active: boolean) =>
      active ? usersApi.reactivate(user.id) : usersApi.deactivate(user.id),
    onSuccess: (_updated, active) => {
      notify({
        message: active ? `${user.name} reativado` : `${user.name} desativado`,
        type: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () =>
      notify({ title: 'Não foi possível salvar', message: 'Tente novamente', type: 'error' }),
  });

  if (!user.active) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>Reativar</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>Desativar</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Ele deixa de conseguir se autenticar imediatamente. O histórico de ações dele é
            preservado e a conta pode ser reativada depois.
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
