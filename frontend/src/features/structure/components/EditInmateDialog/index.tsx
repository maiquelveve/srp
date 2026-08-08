import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { structureApi } from '../../api';
import type { Inmate } from '../../types';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Regime é um varchar livre no backend, mas na prática só assume estes três
// valores (backend/src/inmates/entities/inmate.entity.ts) — modelado aqui
// como Select fechado para manter consistência de dados.
const NO_REGIME = '__none__';
const CUSTODY_REGIME_OPTIONS: { value: string; label: string }[] = [
  { value: NO_REGIME, label: 'Nenhum' },
  { value: 'CLOSED', label: 'Fechado' },
  { value: 'SEMI_OPEN', label: 'Semiaberto' },
  { value: 'OPEN', label: 'Aberto' },
];

export interface EditInmateDialogProps {
  inmate: Inmate;
  cellId: number;
  children: ReactNode;
}

/**
 * Edita dados cadastrais do preso (nome/matrícula/nascimento/regime) via
 * `PATCH /inmates/:id`. Status e cela NUNCA passam por aqui — o backend
 * (`UpdateInmateDto`) recusa esses campos de propósito: mudança de status/
 * cela é sempre efeito colateral de uma movimentação registrada, não uma
 * edição de cadastro direta (Constituição VI / research.md #9).
 */
export default function EditInmateDialog({ inmate, cellId, children }: EditInmateDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(inmate.name);
  const [registrationId, setRegistrationId] = useState(inmate.registrationId ?? '');
  const [birthDate, setBirthDate] = useState(inmate.birthDate ?? '');
  const [custodyRegime, setCustodyRegime] = useState(inmate.custodyRegime ?? NO_REGIME);

  const queryClient = useQueryClient();

  const updateInmate = useMutation({
    mutationFn: () =>
      structureApi.updateInmate(inmate.id, {
        name,
        registrationId: registrationId || undefined,
        birthDate: birthDate || undefined,
        custodyRegime: custodyRegime === NO_REGIME ? undefined : custodyRegime,
      }),
    onSuccess: () => {
      notify({ message: `${name} atualizado`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inmates', cellId] });
      setOpen(false);
    },
    onError: () => notify({ title: 'Não foi possível atualizar', message: 'Verifique os dados', type: 'error' }),
  });

  function handleOpenChange(next: boolean): void {
    if (next) {
      setName(inmate.name);
      setRegistrationId(inmate.registrationId ?? '');
      setBirthDate(inmate.birthDate ?? '');
      setCustodyRegime(inmate.custodyRegime ?? NO_REGIME);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar preso</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="inmate-name">Nome</Label>
            <Input id="inmate-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inmate-registration">Matrícula</Label>
            <Input
              id="inmate-registration"
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inmate-birthdate">Data de nascimento</Label>
            <Input
              id="inmate-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Regime</Label>
            <Select value={custodyRegime} onValueChange={setCustodyRegime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTODY_REGIME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => updateInmate.mutate()} disabled={!name || updateInmate.isPending}>
            {updateInmate.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
