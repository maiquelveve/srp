import { useMutation } from '@tanstack/react-query';
import { KeyRoundIcon } from 'lucide-react';
import { usersApi } from '../../api';
import type { AdminUser, PasswordActionResult } from '../../types';
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
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ResetPasswordDialogProps {
  user: AdminUser;
  /** Chamado ao concluir, mesmo com `emailDelivered: false` (FR-007a). */
  onResult: (result: PasswordActionResult) => void;
  /** true = usuário inativo (não pode ter a senha resetada até ser reativado). */
  disabled?: boolean;
}

/**
 * "Resetar senha" (FR-007) — gera senha temporária, envia por e-mail e
 * encerra todas as sessões do usuário. Não é destrutivo o bastante pra
 * justificar o `variant="destructive"` (a conta continua íntegra), mas ainda
 * exige confirmação por afetar imediatamente o acesso do usuário.
 */
export default function ResetPasswordDialog({
  user,
  onResult,
  disabled = false,
}: ResetPasswordDialogProps): JSX.Element {
  const mutation = useMutation({
    mutationFn: () => usersApi.resetPassword(user.id),
    onSuccess: (result) => {
      notify({ message: result.message, type: result.emailDelivered ? 'success' : 'warning' });
      onResult(result);
    },
    onError: () =>
      notify({ title: 'Não foi possível resetar a senha', message: 'Tente novamente', type: 'error' }),
  });

  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={disabled ? 'cursor-not-allowed' : undefined}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled || mutation.isPending}
              >
                <KeyRoundIcon className="size-3.5" />
                <span className="sr-only">Resetar senha</span>
              </Button>
            </AlertDialogTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {disabled ? 'Reative o usuário antes de alterar os dados' : 'Resetar senha'}
        </TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resetar a senha de {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Uma senha temporária será gerada e enviada para {user.email}. A senha atual deixa de
            funcionar e todas as sessões abertas dele são encerradas imediatamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => mutation.mutate()}>Resetar senha</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
