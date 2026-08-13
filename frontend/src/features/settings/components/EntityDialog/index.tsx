import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { structureApi } from '@/features/structure/api';
import type { Cell, Gallery, Unit } from '@/features/structure/types';
import { notify } from '@/lib/notify';
import { Badge } from '@/components/ui/badge';
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

type EntityDialogProps =
  | { entityType: 'unit'; unit?: Unit; children: ReactNode }
  | { entityType: 'gallery'; unitId: number; gallery?: Gallery; children: ReactNode }
  | { entityType: 'cell'; galleryId: number; cell?: Cell; children: ReactNode };

const LABEL_BY_TYPE: Record<EntityDialogProps['entityType'], string> = {
  unit: 'Unidade',
  gallery: 'Galeria',
  cell: 'Cela',
};

function existingEntity(props: EntityDialogProps): Unit | Gallery | Cell | undefined {
  if (props.entityType === 'unit') return props.unit;
  if (props.entityType === 'gallery') return props.gallery;
  return props.cell;
}

/**
 * Create AND edit dialog for Units/Galleries/Cells (same
 * create-or-edit-in-one-form shape as `InmateDialog`), used from the
 * `/configuracoes` screen (tasks.md T034h/T034h-follow-up) — one instance
 * per row/section, fixed to its own `entityType`. Renamed from
 * `CreateEntityDialog` once edit joined create here.
 *
 * Galeria/Cela edits go through `structureApi.updateGalleryMock`/
 * `updateCellMock` — client-side mocks, since the backend has no
 * `PATCH /galleries/:id` or `/cells/:id` yet (research.md #21). Unit edits
 * are real (`PATCH /units/:id` already exists).
 */
export default function EntityDialog(props: EntityDialogProps): JSX.Element {
  const { entityType, children } = props;
  const entity = existingEntity(props);
  const isEdit = entity !== undefined;

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(entity?.code ?? '');
  const [name, setName] = useState(entityType === 'unit' ? (entity as Unit | undefined)?.name ?? '' : '');
  const [capacity, setCapacity] = useState(entityType === 'cell' ? (entity as Cell | undefined)?.capacity ?? 1 : 1);
  const [type, setType] = useState(
    entityType !== 'unit' ? (entity as Gallery | Cell | undefined)?.type ?? '' : '',
  );
  // Only unit edit exposes this — it's the only entity with a real reactivate
  // path (`DeactivateAlert` only ever turns it off; without this, a
  // deactivated Unit could never come back through the UI).
  const [active, setActive] = useState((entity as Unit | undefined)?.active ?? true);

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setCode(entity?.code ?? '');
      setName(entityType === 'unit' ? (entity as Unit | undefined)?.name ?? '' : '');
      setCapacity(entityType === 'cell' ? (entity as Cell | undefined)?.capacity ?? 1 : 1);
      setActive((entity as Unit | undefined)?.active ?? true);
      setType(entityType !== 'unit' ? (entity as Gallery | Cell | undefined)?.type ?? '' : '');
    }
    setOpen(next);
  }

  const mutation = useMutation<Unit | Gallery | Cell, unknown, void>({
    mutationFn: () => {
      if (entityType === 'unit') {
        return isEdit
          ? structureApi.updateUnit((entity as Unit).id, { name, code: code || undefined, active })
          : structureApi.createUnit({ name, code: code || undefined });
      }
      if (entityType === 'gallery') {
        return isEdit
          ? structureApi.updateGalleryMock(entity as Gallery, { code, type: type || undefined })
          : structureApi.createGallery({ unitId: props.unitId, code, type: type || undefined });
      }
      return isEdit
        ? structureApi.updateCellMock(entity as Cell, { code, capacity, type: type || undefined })
        : structureApi.createCell({ galleryId: props.galleryId, code, capacity, type: type || undefined });
    },
    onSuccess: () => {
      const isMock = isEdit && entityType !== 'unit';
      notify({
        message: `${isEdit ? 'Edição' : 'Cadastro'} de ${LABEL_BY_TYPE[entityType]} concluído${isMock ? ' (simulado — backend ainda não implementado)' : ''}`,
        type: isMock ? 'info' : 'success',
      });
      if (!isMock) {
        if (entityType === 'unit') void queryClient.invalidateQueries({ queryKey: ['units'] });
        if (entityType === 'gallery') void queryClient.invalidateQueries({ queryKey: ['galleries', props.unitId] });
        if (entityType === 'cell') void queryClient.invalidateQueries({ queryKey: ['cells', props.galleryId] });
      }
      setOpen(false);
    },
    onError: () => notify({ title: 'Não foi possível salvar', message: 'Verifique os dados', type: 'error' }),
  });

  const canSubmit = entityType === 'unit' ? name.length > 0 : code.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar' : 'Cadastrar'} {LABEL_BY_TYPE[entityType]}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {entityType === 'unit' && (
            <div className="grid gap-1.5">
              <Label htmlFor="unit-name">Nome</Label>
              <Input id="unit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          {/* Only offered when already inactive — one-way reactivate here.
              Deactivating stays exclusively behind the confirmed
              `DeactivateAlert` flow, so there's a single path for it. */}
          {entityType === 'unit' && isEdit && !(entity as Unit).active && (
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <button type="button" onClick={() => setActive(true)} className="w-fit">
                <Badge variant={active ? 'success' : 'secondary'}>
                  {active ? 'Ativo — será reativada ao salvar' : 'Inativo — clique para reativar'}
                </Badge>
              </button>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="entity-code">Código{entityType === 'unit' ? ' (opcional)' : ''}</Label>
            <Input id="entity-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>

          {entityType === 'cell' && (
            <div className="grid gap-1.5">
              <Label htmlFor="cell-capacity">Capacidade</Label>
              <Input
                id="cell-capacity"
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </div>
          )}

          {entityType !== 'unit' && (
            <div className="grid gap-1.5">
              <Label htmlFor="entity-type">Tipo (opcional)</Label>
              <Input
                id="entity-type"
                placeholder={entityType === 'gallery' ? 'Ex.: MALE, FEMALE' : 'Ex.: SHARED, INDIVIDUAL'}
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
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
