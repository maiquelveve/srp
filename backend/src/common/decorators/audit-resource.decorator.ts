import { SetMetadata } from '@nestjs/common';

export const AUDIT_RESOURCE_KEY = 'audit:resource';

/** Names the `audit_logs.affected_table` value for a controller/handler explicitly. */
export const AuditResource = (tableName: string): MethodDecorator & ClassDecorator =>
  SetMetadata(AUDIT_RESOURCE_KEY, tableName);
