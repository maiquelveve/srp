import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClockIcon,
  CircleHelpIcon,
  ClockIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { structureApi } from '@/features/structure/api';
import { routinesApi } from './api';
import { ROUTINE_TYPE_LABEL, weekdayLabel } from './labels';
import { toHHMM } from './time';
import ActivationDialog from './components/ActivationDialog';
import DatePicker from './components/DatePicker';
import DeleteRoutineAlert from './components/DeleteRoutineAlert';
import RoutineDialog from './components/RoutineDialog';
import ScheduleDialog from './components/ScheduleDialog';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ícone-only "Editar horários" — relógio (o que está sendo editado) + lápis (a ação), research.md. */
function EditScheduleIcon(): JSX.Element {
  return (
    <span className="relative inline-flex">
      <ClockIcon className="size-3.5" />
      <PencilIcon className="absolute -bottom-1 -right-1.5 size-2.5 rounded-full bg-background" />
    </span>
  );
}

/**
 * Gestão de Rotinas Operacionais (User Story 4, FR-017…FR-020). Esta tela
 * consulta `GET /routines` com `includeInactive=true` — diferente do uso de
 * consulta somente-leitura (mobile, FR-020), que só traz o que está
 * efetivamente ativo na data — para que uma rotina desativada só para uma
 * data continue visível (e gerenciável) aqui, com o badge "Status"
 * refletindo Ativa/Inativa naquela data.
 */
export default function RoutinesPage(): JSX.Element {
  const { user } = useAuth();
  const isWarden = user?.role === 'WARDEN';
  const canEditSchedule = user?.role === 'WARDEN' || user?.role === 'SUPERVISOR';

  const [unitId, setUnitId] = useState<number | null>(null);
  const [galleryId, setGalleryId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIsoDate());

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleries(unitId as number),
    enabled: unitId !== null,
  });

  useEffect(() => {
    if (!unitsQuery.data || unitsQuery.data.data.length === 0) return;
    const stillValid = unitId !== null && unitsQuery.data.data.some((u) => u.id === unitId);
    if (!stillValid) {
      setUnitId(unitsQuery.data.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, unitsQuery.data]);

  useEffect(() => {
    if (!galleriesQuery.data) return;
    const stillValid = galleryId !== null && galleriesQuery.data.data.some((g) => g.id === galleryId);
    if (!stillValid) {
      setGalleryId(galleriesQuery.data.data[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, galleriesQuery.data]);

  const routinesQuery = useQuery({
    queryKey: ['routines', galleryId, date],
    queryFn: () =>
      routinesApi.list({ galleryId: galleryId as number, date, includeInactive: true }),
    enabled: galleryId !== null,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-[200px] flex-1 gap-1.5">
          <Label>Unidade</Label>
          <Select value={unitId ? String(unitId) : ''} onValueChange={(v) => setUnitId(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {(unitsQuery.data?.data ?? []).map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[200px] flex-1 gap-1.5">
          <Label>Galeria</Label>
          <Select
            value={galleryId ? String(galleryId) : ''}
            onValueChange={(v) => setGalleryId(Number(v))}
            disabled={unitId === null}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a galeria" />
            </SelectTrigger>
            <SelectContent>
              {(galleriesQuery.data?.data ?? []).map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="routines-date">Data</Label>
          <DatePicker id="routines-date" value={date} onChange={setDate} className="w-40" />
        </div>

        {isWarden && galleryId !== null && (
          <RoutineDialog galleryId={galleryId}>
            <Button className="gap-1">
              <PlusIcon className="size-4" />
              Nova Rotina
            </Button>
          </RoutineDialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Horários</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1">
                        Padrão
                        <CircleHelpIcon className="size-3.5 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      Rotina padrão, definida pela Chefia/Diretor: não pode ser editada por
                      Supervisor nem excluída.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(routinesQuery.data?.data ?? []).map((routine) => {
                const scheduleLocked = routine.locked && user?.role === 'SUPERVISOR';
                return (
                  <TableRow key={routine.id}>
                    <TableCell>{routine.name}</TableCell>
                    <TableCell>{ROUTINE_TYPE_LABEL[routine.type]}</TableCell>
                    <TableCell>
                      {routine.schedules
                        .map((s) => `${weekdayLabel(s.weekday)} ${toHHMM(s.time)}`)
                        .join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={routine.active ? 'success' : 'secondary'}>
                        {routine.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={routine.locked ? 'secondary' : 'outline'}>
                        {routine.locked ? 'Padrão' : 'Específica'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        {canEditSchedule && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={scheduleLocked ? 'cursor-not-allowed' : undefined}>
                                  <ScheduleDialog routine={routine} galleryId={galleryId as number}>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      disabled={scheduleLocked}
                                    >
                                      <EditScheduleIcon />
                                      <span className="sr-only">Editar horários</span>
                                    </Button>
                                  </ScheduleDialog>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {scheduleLocked
                                  ? 'Rotina padrão não pode ser alterada por este perfil'
                                  : 'Editar horários'}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={scheduleLocked ? 'cursor-not-allowed' : undefined}>
                                  <ActivationDialog routine={routine} galleryId={galleryId as number}>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      disabled={scheduleLocked}
                                    >
                                      <CalendarClockIcon className="size-3.5" />
                                      <span className="sr-only">Ativar/desativar por data</span>
                                    </Button>
                                  </ActivationDialog>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {scheduleLocked
                                  ? 'Rotina padrão não pode ser alterada por este perfil'
                                  : 'Ativar/desativar por data'}
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}

                        {isWarden && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={routine.locked ? 'cursor-not-allowed' : undefined}>
                                <DeleteRoutineAlert routine={routine} galleryId={galleryId as number}>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    disabled={routine.locked}
                                    className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  >
                                    <Trash2Icon className="size-3.5" />
                                    <span className="sr-only">Excluir</span>
                                  </Button>
                                </DeleteRoutineAlert>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {routine.locked ? 'Rotina padrão não pode ser excluída' : 'Excluir'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {routinesQuery.data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma rotina programada para esta data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
