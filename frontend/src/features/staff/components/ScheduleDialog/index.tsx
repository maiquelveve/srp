import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, ChevronsUpDown } from 'lucide-react';
import { staffApi } from '../../api';
import { SHIFT_OPTIONS, WORKLOAD_HOURS_OPTIONS } from '../../labels';
import type { Post, Shift } from '../../types';
import DateHighlight from '../DateHighlight';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NO_POST = 'none';

type PostByShift = Record<Shift, string>;

const EMPTY_POST_BY_SHIFT: PostByShift = { DAY: NO_POST, NIGHT: NO_POST };

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Registra o dia de um policial numa única escala (SUPERVISOR/WARDEN,
 * FR-021/FR-022): a carga horária do dia (obrigatória, FR-022b) e o posto de
 * cada turno, que pode mudar do diurno para o noturno. Turno sem posto não é
 * escalado; pelo menos um turno é obrigatório. A data vem do filtro da página.
 *
 * Se o policial já tem escala nessa data, a carga horária vem preenchida e
 * travada (ela é do dia) e o turno já escalado aparece só para leitura, então
 * dá para completar o outro turno depois sem a API recusar.
 */
export default function ScheduleDialog({
  unitId,
  date,
  posts,
  children,
}: {
  unitId: number;
  date: string;
  posts: Post[];
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [officerId, setOfficerId] = useState<number | null>(null);
  const [postByShift, setPostByShift] = useState<PostByShift>(EMPTY_POST_BY_SHIFT);
  const [workloadHours, setWorkloadHours] = useState('');
  const [officerComboOpen, setOfficerComboOpen] = useState(false);
  const [officerSearch, setOfficerSearch] = useState('');

  const queryClient = useQueryClient();

  const officersQuery = useQuery({
    queryKey: ['officers', unitId],
    queryFn: () => staffApi.listOfficers(unitId),
    enabled: open,
  });
  const daySchedulesQuery = useQuery({
    queryKey: ['schedules', unitId, date, 'all-shifts'],
    queryFn: () => staffApi.listSchedules({ unitId, date }),
    enabled: open,
  });

  const officers = officersQuery.data?.data ?? [];
  const selectedOfficer = officers.find((officer) => officer.id === officerId);
  const filteredOfficers = officers.filter((officer) =>
    officer.name.toLowerCase().includes(officerSearch.trim().toLowerCase()),
  );

  const officerDaySchedules = (daySchedulesQuery.data?.data ?? []).filter(
    (schedule) => schedule.userId === officerId,
  );
  const lockedWorkloadHours = officerDaySchedules[0]?.workloadHours;
  const effectiveWorkloadHours =
    lockedWorkloadHours !== undefined ? String(lockedWorkloadHours) : workloadHours;
  const workloadOptions =
    lockedWorkloadHours !== undefined && !WORKLOAD_HOURS_OPTIONS.includes(lockedWorkloadHours)
      ? [...WORKLOAD_HOURS_OPTIONS, lockedWorkloadHours].sort((first, second) => first - second)
      : WORKLOAD_HOURS_OPTIONS;

  const assignments = SHIFT_OPTIONS.filter(
    (option) =>
      postByShift[option.value] !== NO_POST &&
      !officerDaySchedules.some((schedule) => schedule.shift === option.value),
  ).map((option) => ({ shift: option.value, postId: Number(postByShift[option.value]) }));

  function handleOpenChange(next: boolean): void {
    if (next) {
      setOfficerId(null);
      setPostByShift(EMPTY_POST_BY_SHIFT);
      setWorkloadHours('');
      setOfficerSearch('');
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () =>
      staffApi.createSchedule({
        userId: officerId as number,
        unitId,
        date,
        workloadHours: Number(effectiveWorkloadHours),
        assignments,
      }),
    onSuccess: () => {
      notify({ message: 'Escala cadastrada', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['minimum-staffing'] });
      setOpen(false);
    },
    onError: (error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      notify({
        title: 'Não foi possível salvar',
        message:
          status === 409
            ? 'Este policial já está escalado em um dos turnos escolhidos'
            : status === 422
              ? 'A carga horária deve ser a mesma em todos os turnos do dia'
              : 'Verifique os dados',
        type: 'error',
      });
    },
  });

  const canSubmit = officerId !== null && effectiveWorkloadHours !== '' && assignments.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova escala</DialogTitle>
          <DialogDescription className="sr-only">{formatDate(date)}</DialogDescription>
        </DialogHeader>

        <DateHighlight isoDate={date} />

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="schedule-officer">Policial</Label>
            <Popover open={officerComboOpen} onOpenChange={setOfficerComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="schedule-officer"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={officerComboOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedOfficer?.name ?? 'Selecione o policial'}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar policial..."
                    value={officerSearch}
                    onValueChange={setOfficerSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum policial encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredOfficers.map((officer) => (
                        <CommandItem
                          key={officer.id}
                          value={officer.name}
                          onSelect={() => {
                            setOfficerId(officer.id);
                            setOfficerComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'size-4',
                              officer.id === officerId ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span className="flex flex-col">
                            {officer.name}
                            {officer.jobTitle && (
                              <span className="text-xs text-muted-foreground">
                                {officer.jobTitle}
                              </span>
                            )}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="schedule-workload">Carga horária do dia</Label>
            <Select
              value={effectiveWorkloadHours}
              onValueChange={setWorkloadHours}
              disabled={lockedWorkloadHours !== undefined}
            >
              <SelectTrigger id="schedule-workload">
                <SelectValue placeholder="Selecione a carga horária" />
              </SelectTrigger>
              <SelectContent>
                {workloadOptions.map((hours) => (
                  <SelectItem key={hours} value={String(hours)}>
                    {hours} horas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lockedWorkloadHours !== undefined && (
              <p className="text-xs text-muted-foreground">
                Este policial já está escalado neste dia, com esta carga horária.
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Posto em cada turno</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {SHIFT_OPTIONS.map((option) => {
                const existing = officerDaySchedules.find(
                  (schedule) => schedule.shift === option.value,
                );
                return (
                  <div key={option.value} className="grid gap-1.5">
                    <Label htmlFor={`schedule-post-${option.value}`} className="font-normal">
                      {option.label}
                    </Label>
                    {existing ? (
                      <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                        Já escalado: {existing.postName}
                      </div>
                    ) : (
                      <Select
                        value={postByShift[option.value]}
                        onValueChange={(value) =>
                          setPostByShift((current) => ({ ...current, [option.value]: value }))
                        }
                      >
                        <SelectTrigger id={`schedule-post-${option.value}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_POST}>Sem escala neste turno</SelectItem>
                          {posts.map((post) => (
                            <SelectItem key={post.id} value={String(post.id)}>
                              {post.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
            {posts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                A Chefia/Diretor precisa cadastrar os postos de serviço da unidade.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Escolha o posto de pelo menos um turno. O posto pode mudar do diurno para o noturno.
              </p>
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
  );
}
