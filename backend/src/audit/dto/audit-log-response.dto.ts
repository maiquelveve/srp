import { AuditAction, AuditLog } from '../entities/audit-log.entity';

export class AuditLogResponseDto {
  id: number;
  userId: number | null;
  userName: string | null;
  affectedTable: string | null;
  recordId: number | null;
  action: AuditAction;
  /** Já redigido pelo `AuditService` na gravação (research.md #6). */
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  timestamp: Date;

  static fromEntity(log: AuditLog): AuditLogResponseDto {
    const dto = new AuditLogResponseDto();
    dto.id = log.id;
    dto.userId = log.user?.id ?? null;
    dto.userName = log.user?.name ?? null;
    dto.affectedTable = log.affectedTable;
    dto.recordId = log.recordId;
    dto.action = log.action;
    dto.oldData = log.oldData;
    dto.newData = log.newData;
    dto.timestamp = log.timestamp;
    return dto;
  }
}
