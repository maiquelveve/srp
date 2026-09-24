import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { staffApi } from '../../api';
import type { Post } from '../../types';
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

/** Criar e renomear posto de serviço (WARDEN, FR-022a): mesmo formulário, muda só se `post` veio. */
export default function PostDialog({
  unitId,
  post,
  children,
}: {
  unitId: number;
  post?: Post;
  children: ReactNode;
}): JSX.Element {
  const isEdit = post !== undefined;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setName(post?.name ?? '');
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () =>
      isEdit ? staffApi.updatePost(post.id, { name }) : staffApi.createPost({ unitId, name }),
    onSuccess: () => {
      notify({ message: isEdit ? 'Posto atualizado' : 'Posto cadastrado', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
      // O nome do posto aparece nas escalas e no relatório de efetivo mínimo.
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['minimum-staffing'] });
      setOpen(false);
    },
    onError: (error) =>
      notify({
        title: 'Não foi possível salvar',
        message:
          isAxiosError(error) && error.response?.status === 409
            ? 'Já existe um posto com este nome nesta unidade'
            : 'Verifique os dados',
        type: 'error',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar posto' : 'Novo posto'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="post-name">Nome do posto</Label>
            <Input
              id="post-name"
              value={name}
              maxLength={100}
              placeholder="Ex.: A/B, Pórtico, Garita 1, Infopen"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={name.trim().length === 0 || mutation.isPending}
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
