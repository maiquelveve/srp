import type { AuditAction, CellHistoryReason } from './types';

export const PERIOD_DAYS_OPTIONS = [7, 15, 30, 90, 365];

export const CELL_HISTORY_REASON_LABEL: Record<CellHistoryReason, string> = {
  RELEASE: 'Liberdade',
  ANKLE_MONITOR: 'Tornozeleira',
  TRANSFER: 'Transferência',
  CELL_CHANGE: 'Troca de cela',
  CELL_SWAP: 'Permuta de cela',
  GALLERY_CHANGE: 'Troca de galeria',
  GALLERY_SWAP: 'Permuta de galeria',
};

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  INSERT: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Remoção',
  LOGIN: 'Login',
  LOGIN_FAILED: 'Login recusado',
  LOGOUT: 'Logout',
};

export const AUDIT_ACTION_BADGE_VARIANT: Record<
  AuditAction,
  'success' | 'warning' | 'destructive' | 'info'
> = {
  INSERT: 'success',
  UPDATE: 'warning',
  DELETE: 'destructive',
  LOGIN: 'info',
  LOGIN_FAILED: 'destructive',
  LOGOUT: 'info',
};

/** Nomes de tabela oferecidos no filtro da auditoria (rótulo em português, valor = `affected_table`). */
export const AUDIT_TABLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'inmates', label: 'Presos' },
  { value: 'movements', label: 'Movimentações' },
  { value: 'routines', label: 'Rotinas' },
  { value: 'schedules', label: 'Escalas' },
  { value: 'staff', label: 'Efetivo mínimo' },
  { value: 'posts', label: 'Postos de serviço' },
  { value: 'users', label: 'Usuários' },
  { value: 'units', label: 'Unidades' },
  { value: 'galleries', label: 'Galerias' },
  { value: 'cells', label: 'Celas' },
];

/** Rótulo em português de uma tabela auditada; cai no nome cru se ainda não mapeada. */
export function auditTableLabel(table: string | null): string {
  if (table === null) return '-';
  return AUDIT_TABLE_OPTIONS.find((option) => option.value === table)?.label ?? table;
}

/** Rótulos dos campos que aparecem nos dados auditados; campo não mapeado aparece com o nome técnico. */
export const AUDIT_FIELD_LABEL: Record<string, string> = {
  id: 'ID',
  name: 'Nome',
  code: 'Código',
  email: 'E-mail',
  active: 'Ativo',
  status: 'Situação',
  type: 'Tipo',
  role: 'Perfil',
  description: 'Descrição',
  capacity: 'Capacidade',
  registrationId: 'Matrícula/RGI',
  birthDate: 'Data de nascimento',
  custodyRegime: 'Regime',
  photoUrl: 'Foto',
  notes: 'Observações',
  reason: 'Motivo',
  userId: 'ID do usuário',
  userName: 'Usuário',
  unitId: 'ID da unidade',
  galleryId: 'ID da galeria',
  cellId: 'ID da cela',
  currentCellId: 'ID da cela atual',
  originCellId: 'ID da cela de origem',
  destinationCellId: 'ID da cela de destino',
  inmateId: 'ID do preso',
  movementTypeId: 'ID do tipo de movimentação',
  movementTypeName: 'Tipo de movimentação',
  pairedMovementId: 'ID da movimentação par',
  destinationLocation: 'Local de destino',
  exitDateTime: 'Saída',
  returnDateTime: 'Retorno',
  createdAt: 'Criado em',
  updatedAt: 'Atualizado em',
  date: 'Data',
  shift: 'Turno',
  postId: 'ID do posto',
  postName: 'Posto',
  workloadHours: 'Carga horária (h)',
  attendanceStatus: 'Presença',
  absenceReason: 'Motivo da falta',
  minimumHeadcount: 'Efetivo mínimo',
};

/** Rótulos de valores enumerados frequentes (turno e presença). */
export const AUDIT_VALUE_LABEL: Record<string, string> = {
  DAY: 'Diurno',
  NIGHT: 'Noturno',
  PRESENT: 'Presente',
  ABSENT: 'Falta',
};
