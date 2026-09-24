import { ATTENDANCE_LABEL, SHIFT_LABEL } from '../../labels';
import type { AttendanceStatus, Schedule, Shift } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ATTENDANCE_BADGE_VARIANT: Record<AttendanceStatus, 'success' | 'destructive'> = {
  PRESENT: 'success',
  ABSENT: 'destructive',
};

/** Um turno (Diurno ou Noturno): a lista de policiais escalados. */
export default function ShiftColumn({
  shift,
  schedules,
}: {
  shift: Shift;
  schedules: Schedule[];
}): JSX.Element {
  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-lg font-semibold">{SHIFT_LABEL[shift]}</h2>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Posto</TableHead>
                <TableHead>Carga horária</TableHead>
                <TableHead>Presença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>{schedule.userName}</TableCell>
                  <TableCell>{schedule.postName}</TableCell>
                  <TableCell>{schedule.workloadHours} h</TableCell>
                  <TableCell>
                    {schedule.attendanceStatus ? (
                      <Tooltip open={schedule.attendanceStatus === 'ABSENT' ? undefined : false}>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Badge variant={ATTENDANCE_BADGE_VARIANT[schedule.attendanceStatus]}>
                              {ATTENDANCE_LABEL[schedule.attendanceStatus]}
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Motivo: {schedule.absenceReason || 'MOTIVO NAO INFORMADO'}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant="outline">Não registrada</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {schedules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum policial escalado neste turno.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
