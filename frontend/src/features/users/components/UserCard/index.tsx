import { useMutation } from '@tanstack/react-query';
import { MailWarningIcon, PencilIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import AddUnitsDialog from '../AddUnitsDialog';
import ReplaceUnitsDialog from '../ReplaceUnitsDialog';
import ResetPasswordDialog from '../ResetPasswordDialog';
import UserDialog from '../UserDialog';
import UserStatusButton from '../UserStatusButton';
import { usersApi } from '../../api';
import { ROLE_LABEL } from '../../labels';
import type { AdminUser, PasswordActionResult } from '../../types';
import type { Unit } from '@/features/structure/types';
import { notify } from '@/lib/notify';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface UserCardProps {
  user: AdminUser;
  units: Unit[];
  /** true = a última criação/reset deste usuário não conseguiu entregar o e-mail (FR-002a/FR-007a). */
  hasPendingEmailWarning: boolean;
  onPasswordActionResult: (result: PasswordActionResult) => void;
}

/** Iniciais pro círculo de avatar — até 2 letras (primeiro + último nome). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Um card por usuário — dados cadastrais, lotação e as ações de administração (contracts/users.md). */
export default function UserCard({
  user,
  units,
  hasPendingEmailWarning,
  onPasswordActionResult,
}: UserCardProps): JSX.Element {
  const userUnits = units.filter((unit) => user.units.includes(unit.id));
  // Usuário inativo não pode se autenticar, então alterar seus dados não faz
  // sentido até ser reativado — só o botão de reativar continua ativo
  // (pedido do usuário).
  const editingDisabled = !user.active;
  const editingDisabledReason = 'Reative o usuário antes de alterar os dados';

  const resendEmail = useMutation({
    mutationFn: () => usersApi.resendPasswordEmail(user.id),
    onSuccess: (result) => {
      notify({ message: result.message, type: result.emailDelivered ? 'success' : 'warning' });
      onPasswordActionResult(result);
    },
    onError: () =>
      notify({ title: 'Não foi possível reenviar', message: 'Tente novamente', type: 'error' }),
  });

  return (
    // Mais arredondado (rounded-xl) e com sombra mais forte que o Card padrão
    // (rounded-lg/shadow-sm) — só nesta tela, pedido do usuário: dá a
    // impressão de o card estar "elevado" sobre o fundo. Opacidade da sombra
    // (shadow-black/30) explícita porque o tema é escuro (--background quase
    // preto) — a sombra padrão do Tailwind (rgba preto bem fraco) some contra
    // um fundo já escuro; sem essa opacidade mais alta, o efeito não aparece.
    <Card className="flex h-full flex-col rounded-xl shadow-lg shadow-black/30 transition-shadow hover:shadow-xl hover:shadow-black/40">
      <CardHeader className="flex-row items-start gap-3 space-y-0 pb-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initialsOf(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={user.active ? 'success' : 'secondary'} className="shrink-0">
          {user.active ? 'Ativo' : 'Inativo'}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Matrícula</p>
            <p className="truncate">{user.badgeNumber ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cargo</p>
            <p className="truncate">{user.jobTitle ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Perfil</p>
            <p className="truncate">{ROLE_LABEL[user.role]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lotação</p>
            {userUnits.length > 0 ? (
              <div className="flex flex-col items-start gap-1 pt-0.5">
                {userUnits.map((unit) =>
                  unit.code ? (
                    <Tooltip key={unit.id}>
                      {/* `asChild` precisa de um filho com `React.forwardRef` pra
                          ancorar a posição do tooltip — `Badge` não tem (só
                          `Button` tem, no design system), então o gatilho vai
                          num `<span>` (elemento nativo, sempre repassa ref),
                          não direto no Badge. */}
                      <TooltipTrigger asChild>
                        <span>
                          <Badge variant="outline" className="cursor-default font-normal">
                            {unit.code}
                          </Badge>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{unit.name}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Badge key={unit.id} variant="outline" className="font-normal">
                      {unit.name}
                    </Badge>
                  ),
                )}
              </div>
            ) : (
              <p>-</p>
            )}
          </div>
        </div>

        {/* Empurra o aviso e as ações pro rodapé, mesmo com menos conteúdo acima — cards da mesma linha ficam com a mesma altura. */}
        <div className="mt-auto space-y-3">
          {hasPendingEmailWarning && (
            <Alert variant="warning" size="sm" className="max-w-none">
              <MailWarningIcon />
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                <AlertDescription>E-mail de senha não entregue.</AlertDescription>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-amber-50/40 text-amber-50 hover:bg-amber-50 hover:text-amber-950"
                  disabled={resendEmail.isPending}
                  onClick={() => resendEmail.mutate()}
                >
                  {resendEmail.isPending ? 'Reenviando...' : 'Reenviar e-mail'}
                </Button>
              </div>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={editingDisabled ? 'cursor-not-allowed' : undefined}>
                  <UserDialog user={user} units={units}>
                    <Button type="button" variant="outline" size="icon" disabled={editingDisabled}>
                      <PencilIcon className="size-3.5" />
                      <span className="sr-only">Editar</span>
                    </Button>
                  </UserDialog>
                </span>
              </TooltipTrigger>
              <TooltipContent>{editingDisabled ? editingDisabledReason : 'Editar'}</TooltipContent>
            </Tooltip>

            <UserStatusButton user={user} />

            <Tooltip>
              <TooltipTrigger asChild>
                <span className={editingDisabled ? 'cursor-not-allowed' : undefined}>
                  <ReplaceUnitsDialog user={user} units={units}>
                    <Button type="button" variant="outline" size="icon" disabled={editingDisabled}>
                      <UsersIcon className="size-3.5" />
                      <span className="sr-only">Trocar lotação</span>
                    </Button>
                  </ReplaceUnitsDialog>
                </span>
              </TooltipTrigger>
              <TooltipContent>{editingDisabled ? editingDisabledReason : 'Trocar lotação'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className={editingDisabled ? 'cursor-not-allowed' : undefined}>
                  <AddUnitsDialog user={user} units={units}>
                    <Button type="button" variant="outline" size="icon" disabled={editingDisabled}>
                      <UserPlusIcon className="size-3.5" />
                      <span className="sr-only">Adicionar lotação</span>
                    </Button>
                  </AddUnitsDialog>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {editingDisabled ? editingDisabledReason : 'Adicionar lotação'}
              </TooltipContent>
            </Tooltip>

            <ResetPasswordDialog
              user={user}
              onResult={onPasswordActionResult}
              disabled={editingDisabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
