import { forwardRef, useEffect, useState, type ButtonHTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2Icon,
  CheckCircle2Icon,
  CircleHelpIcon,
  DoorClosedIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Rows3Icon,
  Trash2Icon,
} from 'lucide-react';
import { structureApi } from '@/features/structure/api';
import type { CellType, GalleryType } from '@/features/structure/types';
import DeactivateAlert from './components/DeactivateAlert';
import EntityDialog from './components/EntityDialog';
import ReactivateAlert from './components/ReactivateAlert';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function ActiveBadge({ active }: { active: boolean }): JSX.Element {
  return <Badge variant={active ? 'success' : 'secondary'}>{active ? 'Ativo' : 'Inativo'}</Badge>;
}

// Safe now that the backend constrains `type` to a real enum (tasks.md
// T034h-type-enum) — every value that can reach these tables came from
// `EntityDialog`'s `Select` (GALLERY_TYPE_OPTIONS/CELL_TYPE_OPTIONS), so this
// is total, not a lookup-with-fallback over free text.
const GALLERY_TYPE_LABEL: Record<GalleryType, string> = {
  MALE: 'Masculina',
  FEMALE: 'Feminina',
};
const CELL_TYPE_LABEL: Record<CellType, string> = {
  SHARED: 'Coletiva',
  INDIVIDUAL: 'Individual',
};

const NEW_BUTTON_CLASS =
  'gap-1 border-primary bg-accent px-3 text-xs font-bold text-accent-foreground hover:scale-105';

const SETTINGS_UNIT_STORAGE_KEY = 'srp:settings:lastUnitId';

// Idle (unhovered) tint per action — user asked for color at rest, not just
// on hover. Hover keeps the existing full-fill treatment (already approved).
const TONE_CLASS = {
  primary: 'border-primary/40 bg-primary/10 text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground',
  destructive:
    'border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground',
  // Same tone as ActiveBadge's "Ativo" label — Reativar should read as the
  // green/positive counterpart to Desativar, not another yellow action like
  // Editar.
  success:
    'border-success/40 bg-success/10 text-success hover:border-success hover:bg-success hover:text-success-foreground',
} as const;

// `forwardRef` on purpose: this is used as the direct child of
// `DialogTrigger`/`AlertDialogTrigger` (`asChild`), which clones a ref onto
// it — a plain function component would trigger React's "Function
// components cannot be given refs" warning (bit us once already on this
// screen, see tasks.md T034h).
const RowActionButton = forwardRef<
  HTMLButtonElement,
  { label: string; icon: typeof PencilIcon; tone: keyof typeof TONE_CLASS } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ label, icon: Icon, tone, className, ...props }, ref) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        ref={ref}
        type="button"
        variant="outline"
        size="icon"
        className={cn('h-7 w-7', TONE_CLASS[tone], className)}
        {...props}
      >
        <Icon className="size-3.5" />
        <span className="sr-only">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
));
RowActionButton.displayName = 'RowActionButton';

/**
 * `/configuracoes` — Units/Galleries/Cells management (tasks.md T034h).
 * WARDEN-only, same pattern as the rest of the app (backend already rejects
 * non-WARDEN writes on these endpoints — this just avoids showing a
 * management screen to roles that can't use it). One table at a time inside
 * tabs (Unidades/Galerias/Celas) instead of three stacked cards — reads
 * calmer than everything at once.
 */
export default function SettingsPage(): JSX.Element {
  const { user } = useAuth();

  const [unitId, setUnitIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(SETTINGS_UNIT_STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  // F5 was resetting the selected unit back to the first one in the list —
  // remember it across reloads the simple way, via localStorage.
  function setUnitId(id: number): void {
    setUnitIdState(id);
    localStorage.setItem(SETTINGS_UNIT_STORAGE_KEY, String(id));
  }
  const [galleryId, setGalleryId] = useState<number | null>(null);
  const [cellStatusFilter, setCellStatusFilter] = useState<'active' | 'inactive'>('active');

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleries(unitId as number),
    enabled: unitId !== null,
  });
  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId as number),
    enabled: galleryId !== null,
  });

  const units = unitsQuery.data?.data ?? [];
  const galleries = galleriesQuery.data?.data ?? [];
  const cells = (cellsQuery.data?.data ?? []).filter((cell) =>
    cellStatusFilter === 'active' ? cell.active : !cell.active,
  );
  const selectedUnit = units.find((u) => u.id === unitId);

  // Auto-pick the first unit so the lower tabs aren't empty on load — but
  // only if nothing's selected yet, or the unit restored from localStorage
  // isn't in this user's accessible list anymore.
  useEffect(() => {
    if (!unitsQuery.data || unitsQuery.data.data.length === 0) return;
    const stillValid = unitId !== null && unitsQuery.data.data.some((u) => u.id === unitId);
    if (!stillValid) {
      setUnitId(unitsQuery.data.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, unitsQuery.data]);

  useEffect(() => {
    setGalleryId(galleries.length > 0 ? galleries[0].id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, galleriesQuery.data]);

  if (user?.role !== 'WARDEN') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acesso restrito à Chefia/Diretor.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="units">
            <TabsList>
              <TabsTrigger value="units">
                <Building2Icon className="size-4" />
                Unidades
              </TabsTrigger>
              <TabsTrigger value="galleries">
                <Rows3Icon className="size-4" />
                Galerias
              </TabsTrigger>
              <TabsTrigger value="cells">
                <DoorClosedIcon className="size-4" />
                Celas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="units" className="pt-4">
              <div className="flex justify-end pb-3">
                <EntityDialog entityType="unit">
                  <Button variant="outline" size="sm" className={NEW_BUTTON_CLASS}>
                    <PlusIcon className="size-3.5" />
                    Nova Unidade
                  </Button>
                </EntityDialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-0 text-left">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center text-muted-foreground hover:text-foreground"
                          >
                            <CircleHelpIcon className="size-4" />
                            <span className="sr-only">Como selecionar uma unidade</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-accent text-muted-foreground">
                          <p>Clique em uma unidade para selecioná-la.</p>
                          <p>A seleção define qual unidade a aba Galerias mostra.</p>
                          <TooltipArrow className="fill-accent" />
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="w-64 text-left">Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => {
                    const isSelected = unit.id === unitId;
                    return (
                      <TableRow key={unit.id} onClick={() => setUnitId(unit.id)} className="cursor-pointer">
                        <TableCell className="pl-0 text-left">
                          {isSelected && <CheckCircle2Icon className="size-4 text-success" />}
                        </TableCell>
                        <TableCell className="w-64 text-left">{unit.name}</TableCell>
                        <TableCell>{unit.code ?? '—'}</TableCell>
                        <TableCell>
                          <ActiveBadge active={unit.active} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <EntityDialog entityType="unit" unit={unit}>
                              <RowActionButton label="Editar" icon={PencilIcon} tone="primary" />
                            </EntityDialog>
                            {unit.active ? (
                              <DeactivateAlert entityType="unit" unit={unit}>
                                <RowActionButton label="Desativar" icon={Trash2Icon} tone="destructive" />
                              </DeactivateAlert>
                            ) : (
                              <ReactivateAlert entityType="unit" unit={unit}>
                                <RowActionButton label="Reativar" icon={RotateCcwIcon} tone="success" />
                              </ReactivateAlert>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {units.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma unidade cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="galleries" className="pt-4">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-success" />
                  <span className="text-sm text-muted-foreground">
                    {selectedUnit?.name ?? 'Selecione uma unidade na aba Unidades'}
                  </span>
                </div>
                {unitId !== null && (
                  <EntityDialog entityType="gallery" unitId={unitId}>
                    <Button variant="outline" size="sm" className={NEW_BUTTON_CLASS}>
                      <PlusIcon className="size-3.5" />
                      Nova Galeria
                    </Button>
                  </EntityDialog>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48 text-left">Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {galleries.map((gallery) => (
                    <TableRow key={gallery.id}>
                      <TableCell className="w-48 text-left">Galeria {gallery.code}</TableCell>
                      <TableCell>{GALLERY_TYPE_LABEL[gallery.type]}</TableCell>
                      <TableCell>
                        <ActiveBadge active={gallery.active} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <EntityDialog entityType="gallery" unitId={unitId as number} gallery={gallery}>
                            <RowActionButton label="Editar" icon={PencilIcon} tone="primary" />
                          </EntityDialog>
                          {gallery.active ? (
                            <DeactivateAlert entityType="gallery" unitId={unitId as number} gallery={gallery}>
                              <RowActionButton label="Desativar" icon={Trash2Icon} tone="destructive" />
                            </DeactivateAlert>
                          ) : (
                            <ReactivateAlert entityType="gallery" unitId={unitId as number} gallery={gallery}>
                              <RowActionButton label="Reativar" icon={RotateCcwIcon} tone="success" />
                            </ReactivateAlert>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {galleries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhuma galeria cadastrada para esta unidade.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="cells" className="pt-4">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">Galeria</span>
                  <Select
                    value={galleryId !== null ? String(galleryId) : ''}
                    onValueChange={(v) => setGalleryId(Number(v))}
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue placeholder="Selecione a galeria" />
                    </SelectTrigger>
                    <SelectContent>
                      {galleries.map((gallery) => (
                        <SelectItem key={gallery.id} value={String(gallery.id)}>
                          Galeria {gallery.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-medium text-foreground">Status</span>
                  <Select
                    value={cellStatusFilter}
                    onValueChange={(v) => setCellStatusFilter(v as 'active' | 'inactive')}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativas</SelectItem>
                      <SelectItem value="inactive">Inativas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {galleryId !== null && (
                  <EntityDialog entityType="cell" galleryId={galleryId}>
                    <Button variant="outline" size="sm" className={NEW_BUTTON_CLASS}>
                      <PlusIcon className="size-3.5" />
                      Nova Cela
                    </Button>
                  </EntityDialog>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32 text-left">Código</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cells.map((cell) => (
                    <TableRow key={cell.id}>
                      <TableCell className="w-32 text-left">{cell.code}</TableCell>
                      <TableCell>{cell.capacity}</TableCell>
                      <TableCell>{CELL_TYPE_LABEL[cell.type]}</TableCell>
                      <TableCell>
                        <ActiveBadge active={cell.active} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <EntityDialog entityType="cell" galleryId={galleryId as number} cell={cell}>
                            <RowActionButton label="Editar" icon={PencilIcon} tone="primary" />
                          </EntityDialog>
                          {cell.active ? (
                            <DeactivateAlert entityType="cell" galleryId={galleryId as number} cell={cell}>
                              <RowActionButton label="Desativar" icon={Trash2Icon} tone="destructive" />
                            </DeactivateAlert>
                          ) : (
                            <ReactivateAlert entityType="cell" galleryId={galleryId as number} cell={cell}>
                              <RowActionButton label="Reativar" icon={RotateCcwIcon} tone="success" />
                            </ReactivateAlert>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cells.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma cela {cellStatusFilter === 'active' ? 'ativa' : 'inativa'} cadastrada para esta
                        galeria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
