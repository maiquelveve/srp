import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, SettingsIcon, SignpostIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { staffApi } from './api';
import { todayIsoDate } from './date';
import { useUnitPosts } from './hooks/useUnitPosts';
import type { MinimumStaffingPost, PostStaffing, Shift } from './types';
import MinimumStaffingSummary from './components/MinimumStaffingSummary';
import ShiftColumn from './components/ShiftColumn';
import ScheduleDialog from './components/ScheduleDialog';
import DatePicker from '@/features/routines/components/DatePicker';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function useMinimumStaffing(unitId: number | null, date: string, shift: Shift, enabled: boolean) {
  return useQuery({
    queryKey: ['minimum-staffing', unitId, date, shift],
    queryFn: () => staffApi.minimumStaffing({ unitId: unitId as number, date, shift }),
    enabled: unitId !== null && enabled,
  });
}

/** Um card por posto, com o efetivo de cada turno (sem somar os turnos). */
function groupByPost(day: MinimumStaffingPost[], night: MinimumStaffingPost[]): PostStaffing[] {
  const byPost = new Map<number, PostStaffing>();
  const add = (shift: Shift, posts: MinimumStaffingPost[]): void => {
    for (const { postId, postName, ...staffing } of posts) {
      const entry = byPost.get(postId) ?? { postId, postName, shifts: [] };
      entry.shifts.push({ shift, ...staffing });
      byPost.set(postId, entry);
    }
  };
  add('DAY', day);
  add('NIGHT', night);
  return [...byPost.values()].sort((a, b) => a.postName.localeCompare(b.postName));
}

/**
 * Controle de Efetivo (User Story 5, FR-021…FR-024): escalas por unidade,
 * data, registro de presença e efetivo mínimo por posto, com Diurno e Noturno lado a lado. Acesso só
 * para SUPERVISOR/WARDEN (FR-002); `PRISON_OFFICER` recebe 403 da API.
 */
export default function StaffPage(): JSX.Element {
  const { user } = useAuth();
  const isWarden = user?.role === 'WARDEN';
  const canViewStaff = user?.role === 'SUPERVISOR' || user?.role === 'WARDEN';

  const { unitId, setUnitId, units, posts } = useUnitPosts();
  const [date, setDate] = useState(todayIsoDate());

  const schedulesQuery = useQuery({
    queryKey: ['schedules', unitId, date],
    queryFn: () => staffApi.listSchedules({ unitId: unitId as number, date }),
    enabled: unitId !== null && canViewStaff,
  });
  const dayStaffingQuery = useMinimumStaffing(unitId, date, 'DAY', canViewStaff);
  const nightStaffingQuery = useMinimumStaffing(unitId, date, 'NIGHT', canViewStaff);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const postSchedules = (schedulesQuery.data?.data ?? []).filter(
    (schedule) => schedule.postId === selectedPostId,
  );

  if (!canViewStaff) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acesso restrito a Supervisor e Chefia/Diretor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-[200px] flex-1 gap-1.5">
          <Label>Unidade</Label>
          <Select
            value={unitId ? String(unitId) : ''}
            onValueChange={(value) => setUnitId(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={String(unit.id)}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="staff-date">Data</Label>
          <DatePicker id="staff-date" value={date} onChange={setDate} className="w-40" />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isWarden && (
            <>
              <Button asChild variant="secondary">
                <Link to="/efetivo/postos">
                  <SignpostIcon />
                  Postos de serviço
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/efetivo/configuracao-minima">
                  <SettingsIcon />
                  Configurar efetivo mínimo
                </Link>
              </Button>
            </>
          )}

          {unitId !== null && (
            <ScheduleDialog unitId={unitId} date={date} posts={posts}>
              <Button>
                <PlusIcon />
                Nova escala
              </Button>
            </ScheduleDialog>
          )}
        </div>
      </div>

      {(dayStaffingQuery.data || nightStaffingQuery.data) && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Postos</h2>
          <MinimumStaffingSummary
            schedules={schedulesQuery.data?.data ?? []}
            posts={groupByPost(
              dayStaffingQuery.data?.posts ?? [],
              nightStaffingQuery.data?.posts ?? [],
            )}
            selectedPostId={selectedPostId}
            onSelect={setSelectedPostId}
          />
        </section>
      )}

      {selectedPostId === null ? (
        <p className="text-sm text-muted-foreground">
          Selecione um posto para ver os policiais escalados em cada turno.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ShiftColumn
            shift="DAY"
            schedules={postSchedules.filter((schedule) => schedule.shift === 'DAY')}
          />
          <ShiftColumn
            shift="NIGHT"
            schedules={postSchedules.filter((schedule) => schedule.shift === 'NIGHT')}
          />
        </div>
      )}
    </div>
  );
}
