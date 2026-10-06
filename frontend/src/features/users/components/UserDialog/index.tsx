import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { usersApi } from '../../api';
import { MAX_UNITS_PER_USER, ROLE_OPTIONS } from '../../labels';
import UnitsCombobox from '../UnitsCombobox';
import type { AdminUser } from '../../types';
import type { RoleName, Unit } from '@/features/structure/types';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface UserDialogProps {
  units: Unit[];
  /** Presente = editar usuário existente; ausente = cadastrar um novo. */
  user?: AdminUser;
  /** Chamado quando o cadastro é concluído, mesmo com `emailDelivered: false` (FR-002a). */
  onCreated?: (created: AdminUser) => void;
  children: ReactNode;
}

/**
 * Cadastro E edição no mesmo formulário (padrão `InmateDialog`) — lotação só
 * existe na criação (FR-001); depois de criado, lotação só muda por "Trocar
 * lotação"/"Adicionar lotação" (contracts/users.md). E-mail É editável nos
 * dois casos (FR-003): corrige um erro de digitação no cadastro sem deixar
 * o usuário original órfão no banco — a API valida duplicidade (`409`).
 * Perfil também é editável nos dois casos, incluindo promover/rebaixar de
 * Chefia/Diretor (FR-003, Clarifications #1) — a própria API bloqueia isso
 * `403` só quando o alvo é a própria conta do requisitante (FR-008a); o
 * formulário não replica essa checagem, deixa a mensagem de erro da API
 * aparecer.
 */
export default function UserDialog({ units, user, onCreated, children }: UserDialogProps): JSX.Element {
  const isEdit = user !== undefined;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [badgeNumber, setBadgeNumber] = useState(user?.badgeNumber ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [role, setRole] = useState<RoleName | ''>(user?.role ?? '');
  const [unitIds, setUnitIds] = useState<number[]>([]);

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setName(user?.name ?? '');
      setEmail(user?.email ?? '');
      setBadgeNumber(user?.badgeNumber ?? '');
      setJobTitle(user?.jobTitle ?? '');
      setRole(user?.role ?? '');
      setUnitIds([]);
    }
    setOpen(next);
  }

  const createUser = useMutation({
    mutationFn: () =>
      usersApi.create({
        name,
        email,
        badgeNumber: badgeNumber || undefined,
        jobTitle: jobTitle || undefined,
        role: role as RoleName,
        unitIds,
      }),
    onSuccess: (created) => {
      notify({
        message: created.emailDelivered
          ? `${created.name} cadastrado. Senha de acesso enviada por e-mail.`
          : `${created.name} cadastrado.`,
        type: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onCreated?.(created);
      setOpen(false);
    },
    onError: (error) =>
      notify({
        title: 'Não foi possível cadastrar',
        message:
          isAxiosError(error) && error.response?.status === 409
            ? 'Já existe um usuário com este e-mail ou matrícula'
            : 'Verifique os dados informados',
        type: 'error',
      }),
  });

  const updateUser = useMutation({
    mutationFn: () =>
      // Edição sempre envia o campo inteiro (nunca "não mudou") — `null`
      // explícito é o que de fato limpa `badgeNumber`/`jobTitle` no backend;
      // `undefined` seria tratado como "deixa como está" (PATCH parcial) e a
      // limpeza do campo pareceria funcionar na tela sem persistir.
      usersApi.update((user as AdminUser).id, {
        name,
        email,
        badgeNumber: badgeNumber.trim() === '' ? null : badgeNumber,
        jobTitle: jobTitle.trim() === '' ? null : jobTitle,
        role: role as RoleName,
      }),
    onSuccess: () => {
      notify({ message: `${name} atualizado`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
    },
    onError: (error) =>
      notify({
        title: 'Não foi possível atualizar',
        message:
          isAxiosError(error) && error.response?.status === 403
            ? 'Apenas outra Chefia/Diretor pode fazer essa alteração'
            : isAxiosError(error) && error.response?.status === 409
              ? 'Já existe um usuário com este e-mail ou matrícula'
              : 'Verifique os dados informados',
        type: 'error',
      }),
  });

  const mutation = isEdit ? updateUser : createUser;
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    role !== '' &&
    (isEdit || unitIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={isEdit ? undefined : 'sm:max-w-lg'}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuário' : 'Cadastrar usuário'}</DialogTitle>
          {!isEdit && (
            <DialogDescription>
              O usuário recebe uma senha de acesso por e-mail para o primeiro login.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="user-name">Nome</Label>
            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="user-email">E-mail</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="user-badge">Matrícula</Label>
              <Input
                id="user-badge"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-job-title">Cargo</Label>
              <Input
                id="user-job-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(value) => setRole(value as RoleName)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o perfil" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isEdit && (
            <div className="grid gap-1.5 border-t border-border pt-4">
              <Label>Lotação (até {MAX_UNITS_PER_USER})</Label>
              <UnitsCombobox candidateUnits={units} selectedIds={unitIds} onChange={setUnitIds} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
