/** Só há dois turnos (FR-022): Diurno e Noturno. */
export type Shift = 'DAY' | 'NIGHT';

export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export interface Schedule {
  id: number;
  userId: number;
  userName: string;
  unitId: number;
  postId: number;
  postName: string;
  date: string;
  shift: Shift;
  /** Carga horária do policial no DIA (ex.: 24), igual em todos os turnos dele na mesma data. */
  workloadHours: number;
  attendanceStatus: AttendanceStatus | null;
  absenceReason: string | null;
}

/** Policial penal: um `User` com `role=PRISON_OFFICER` (research.md #15). */
export interface Officer {
  id: number;
  name: string;
  jobTitle: string | null;
  badgeNumber: string | null;
}

/** Posto de serviço (FR-022a): galeria, "A/B", pórtico, garita, Infopen... cadastrado pelo diretor. */
export interface Post {
  id: number;
  unitId: number;
  name: string;
  active: boolean;
}

export interface MinimumStaffingPost {
  postId: number;
  postName: string;
  /** Escalados que estão no posto: exclui quem tem falta. */
  staffed: number;
  /** Escalados ausentes (falta). */
  absent: number;
  minimum: number;
  belowMinimum: boolean;
}

/** Efetivo de um posto em cada turno (só os turnos em que o posto aparece no relatório). */
export interface PostStaffing {
  postId: number;
  postName: string;
  shifts: PostShiftStaffing[];
}

export type PostShiftStaffing = Omit<MinimumStaffingPost, 'postId' | 'postName'> & {
  shift: Shift;
};

export interface MinimumStaffingReport {
  date: string;
  shift: Shift;
  posts: MinimumStaffingPost[];
}

export interface MinimumStaffingConfig {
  postId: number;
  shift: Shift;
  minimumHeadcount: number;
}
