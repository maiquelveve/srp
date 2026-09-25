import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditAction, AuditLog } from './entities/audit-log.entity';
import { redact } from './redaction';
import { User } from '../users/entities/user.entity';

export interface RecordAuditEntryInput {
  userId: number | null;
  affectedTable: string | null;
  recordId: number | null;
  action: AuditAction;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}

/**
 * Central write path for `audit_logs` (Constitution III). Never exposes an
 * update/delete for the entries it creates — immutability is enforced simply
 * by there being no such method here and no such endpoint anywhere else.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * `manager` (opcional): grava dentro da transação de quem chama, para a
   * entrada de auditoria e o dado auditado sobreviverem ou falharem juntos.
   */
  async record(entry: RecordAuditEntryInput, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(AuditLog) : this.auditLogRepository;
    const log = repository.create({
      user: entry.userId ? ({ id: entry.userId } as User) : null,
      affectedTable: entry.affectedTable,
      recordId: entry.recordId,
      action: entry.action,
      oldData: redact(entry.oldData ?? null),
      newData: redact(entry.newData ?? null),
    });
    await repository.save(log);
  }
}
