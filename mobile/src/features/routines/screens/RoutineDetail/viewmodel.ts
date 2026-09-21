import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ROUTINE_TYPE_LABEL, weekdayLabel } from '@/features/routines/labels';
import { toHHMM } from '@/features/routines/time';
import type { RootStackParamList } from '@/navigation/types';

type Route = NativeStackScreenProps<RootStackParamList, 'RoutineDetail'>['route'];

/** Somente leitura — criar/editar rotinas é restrito ao painel web (contracts/routines.md). */
export function useRoutineDetailViewModel(route: Route) {
  const { routine, galleryCode } = route.params;

  return {
    name: routine.name,
    typeLabel: ROUTINE_TYPE_LABEL[routine.type],
    galleryCode,
    originLabel: routine.locked ? 'Padrão' : 'Específica',
    isActive: routine.active,
    description: routine.description?.trim() || null,
    schedules: routine.schedules.map((schedule) => ({
      id: schedule.id,
      weekdayLabel: weekdayLabel(schedule.weekday),
      time: toHHMM(schedule.time),
      active: schedule.active,
    })),
  };
}
