import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { KeyRoundIcon, SettingsIcon } from 'lucide-react';
import { profileApi } from '../../api';
import { tokenStorage } from '@/services/token-storage';
import { notify } from '@/lib/notify';
import PasswordInput from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Gatilho (engrenagem) da tela de perfil, agora um menu (mesmo padrão de
 * `NavUser`) em vez de abrir o modal direto — hoje com um único item
 * ("Alterar senha"), espaço já pronto pra outras ações de conta futuras.
 * O `Dialog` é controlado (`open`/`onOpenChange`) em vez de ter seu próprio
 * `DialogTrigger`, porque o gatilho real é o item do menu, não um botão
 * solto — menu fecha e dialog abre em sequência, sem disputa de foco entre
 * os dois overlays do Radix.
 *
 * "Alterar senha" (FR-016/FR-017) — qualquer usuário autenticado troca a
 * própria senha informando a atual; o backend revoga as demais sessões,
 * mantendo válida só a deste dispositivo (FR-017a, contracts/auth.md), por
 * isso não há logout nem redirecionamento ao concluir.
 */
export default function ChangePasswordDialog(): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function handleDialogOpenChange(next: boolean): void {
    // Limpa ao FECHAR (não ao abrir): abrir pelo item do menu chama
    // `setDialogOpen(true)` direto (abaixo), sem passar por aqui — então
    // limpar só "ao abrir" nunca rodava de verdade, e os campos ficavam
    // com o valor da vez anterior até a página ser recarregada.
    if (!next) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setDialogOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('Sessão sem refresh token');
      }
      return profileApi.changePassword({ currentPassword, newPassword, refreshToken });
    },
    onSuccess: () => {
      notify({ message: 'Senha alterada com sucesso', type: 'success' });
      handleDialogOpenChange(false);
    },
    onError: (error) =>
      notify({
        title: 'Não foi possível alterar a senha',
        // 400 cobre tanto "senha atual incorreta" quanto "nova senha fora da
        // política" (contracts/auth.md) — na prática só o primeiro caso
        // chega aqui, já que `canSubmit` abaixo bloqueia o envio com
        // `newPassword` curta antes mesmo da chamada à API.
        message:
          isAxiosError(error) && error.response?.status === 400
            ? 'Senha atual incorreta'
            : 'Tente novamente',
        type: 'error',
      }),
  });

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword === newPassword;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground"
          >
            <SettingsIcon className="size-5" />
            <span className="sr-only">Configurações da conta</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setDialogOpen(true);
            }}
          >
            <KeyRoundIcon />
            Alterar senha
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>
              As demais sessões abertas são encerradas. Esta continua ativa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="current-password">Senha atual</Label>
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH && (
                <p className="text-sm text-destructive">
                  A senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p className="text-sm text-destructive">As senhas não coincidem</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
