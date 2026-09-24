import MovementsByInmateTab from './components/MovementsByInmateTab';
import LongestOutOfCellTab from './components/LongestOutOfCellTab';
import InconsistenciesTab from './components/InconsistenciesTab';
import RoutineExecutionTab from './components/RoutineExecutionTab';
import StaffVsMovementsTab from './components/StaffVsMovementsTab';
import CellOccupancyTab from './components/CellOccupancyTab';
import { useSelectedUnit } from './hooks/useSelectedUnit';
import { useAuth } from '@/hooks/useAuth';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Relatórios (User Story 6, FR-025): um relatório por aba, sempre sobre a
 * unidade selecionada. Acesso só para SUPERVISOR/WARDEN (FR-028);
 * `PRISON_OFFICER` recebe 403 da API.
 */
export default function ReportsPage(): JSX.Element {
  const { user } = useAuth();
  const canViewReports = user?.role === 'SUPERVISOR' || user?.role === 'WARDEN';
  const { unitId, setUnitId, units } = useSelectedUnit();

  if (!canViewReports) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Acesso restrito a Supervisor e Chefia/Diretor.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-[200px] flex-1 gap-1.5">
          <Label htmlFor="reports-unit">Unidade</Label>
          <Select
            value={unitId ? String(unitId) : ''}
            onValueChange={(value) => setUnitId(Number(value))}
          >
            <SelectTrigger id="reports-unit">
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
      </div>

      <Tabs defaultValue="longest-out">
        {/* Linha única: o indicador deslizante da aba ativa só funciona sem quebra de linha. */}
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList>
            <TabsTrigger value="longest-out">Fora da cela</TabsTrigger>
            <TabsTrigger value="inconsistencies">Inconsistências</TabsTrigger>
            <TabsTrigger value="movements">Por preso</TabsTrigger>
            <TabsTrigger value="routines">Rotinas</TabsTrigger>
            <TabsTrigger value="staff">Efetivo</TabsTrigger>
            <TabsTrigger value="occupancy">Celas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="longest-out">
          <LongestOutOfCellTab unitId={unitId} />
        </TabsContent>
        <TabsContent value="inconsistencies">
          <InconsistenciesTab unitId={unitId} />
        </TabsContent>
        <TabsContent value="movements">
          <MovementsByInmateTab unitId={unitId} />
        </TabsContent>
        <TabsContent value="routines">
          <RoutineExecutionTab unitId={unitId} />
        </TabsContent>
        <TabsContent value="staff">
          <StaffVsMovementsTab unitId={unitId} />
        </TabsContent>
        <TabsContent value="occupancy">
          <CellOccupancyTab unitId={unitId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
