import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

const DEFAULT_LIMIT = 50;

/** Read path for `audit_logs` (FR-026); the write path lives in `AuditService`. */
@Injectable()
export class AuditQueryService {
  constructor(
    @InjectRepository(AuditLog) private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Restricted to entries authored by users linked to at least one of the
   * caller's units (FR-004a). Entries without an author (e.g. failed logins
   * for unknown e-mails) belong to no unit and are therefore never returned.
   */
  async list(
    query: AuditQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<AuditLogResponseDto>> {
    if (callerUnitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }

    const builder = this.auditLogRepository
      .createQueryBuilder('log')
      .innerJoinAndSelect('log.user', 'author')
      .where(
        `EXISTS (SELECT 1 FROM user_units author_units
                 WHERE author_units.user_id = author.id AND author_units.unit_id IN (:...unitIds))`,
        { unitIds: callerUnitIds },
      );
    if (query.table) builder.andWhere('log.affectedTable = :table', { table: query.table });
    if (query.recordId !== undefined) {
      builder.andWhere('log.recordId = :recordId', { recordId: query.recordId });
    }
    if (query.from) builder.andWhere('log.timestamp >= :from', { from: query.from });
    if (query.to) builder.andWhere('log.timestamp <= :to', { to: query.to });

    const [logs, total] = await builder
      .orderBy('log.timestamp', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .take(query.limit ?? DEFAULT_LIMIT)
      .skip(query.offset ?? 0)
      .getManyAndCount();
    return new PaginatedResponseDto(
      logs.map((log) => AuditLogResponseDto.fromEntity(log)),
      total,
    );
  }
}
