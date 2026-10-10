import 'reflect-metadata';
import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { InviteToken } from '../users/entities/invite-token.entity';
import { Unit } from '../units/entities/unit.entity';
import { Gallery } from '../galleries/entities/gallery.entity';
import { Cell } from '../cells/entities/cell.entity';
import { Inmate } from '../inmates/entities/inmate.entity';
import { InmateCellHistory } from '../inmates/entities/inmate-cell-history.entity';
import { MovementType } from '../movements/entities/movement-type.entity';
import { Movement } from '../movements/entities/movement.entity';
import { Routine } from '../routines/entities/routine.entity';
import { RoutineSchedule } from '../routines/entities/routine-schedule.entity';
import { RoutineDateOverride } from '../routines/entities/routine-date-override.entity';
import { ServicePost } from '../posts/entities/service-post.entity';
import { StaffSchedule } from '../staff/entities/staff-schedule.entity';
import { MinimumStaffingConfig } from '../staff/entities/minimum-staffing-config.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Document } from '../documents/entities/document.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { KnowledgeDocument } from '../knowledge/entities/knowledge-document.entity';
import { KnowledgeDocumentChunk } from '../knowledge/entities/knowledge-document-chunk.entity';
import { KnowledgeQuery } from '../knowledge/entities/knowledge-query.entity';

/**
 * Single source of truth for TypeORM entities and migrations (Constitution IV/VIII).
 * `synchronize` MUST stay false in every environment — schema changes only via
 * migrations under `./migrations` (research.md #8).
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: requireEnv('POSTGRES_HOST'),
  port: Number(requireEnv('POSTGRES_PORT')),
  username: requireEnv('POSTGRES_USER'),
  password: requireEnv('POSTGRES_PASSWORD'),
  database: requireEnv('POSTGRES_DB'),
  entities: [
    Role,
    User,
    RefreshToken,
    InviteToken,
    Unit,
    Gallery,
    Cell,
    Inmate,
    InmateCellHistory,
    MovementType,
    Movement,
    Routine,
    RoutineSchedule,
    RoutineDateOverride,
    ServicePost,
    StaffSchedule,
    MinimumStaffingConfig,
    AuditLog,
    Document,
    DocumentType,
    KnowledgeDocument,
    KnowledgeDocumentChunk,
    KnowledgeQuery,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
