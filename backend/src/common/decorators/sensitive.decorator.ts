import 'reflect-metadata';

const SENSITIVE_METADATA_KEY = 'audit:sensitiveFields';

/**
 * Marks an entity property as sensitive so AuditService redacts it from
 * `audit_logs.old_data`/`new_data` (Constitution II, research.md #6,
 * /speckit-analyze finding C1). Purely a metadata marker — has no runtime
 * effect outside the audit redaction pass.
 */
export function Sensitive(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const ctor = target.constructor;
    const existing: string[] =
      (Reflect.getMetadata(SENSITIVE_METADATA_KEY, ctor) as string[] | undefined) ?? [];
    Reflect.defineMetadata(SENSITIVE_METADATA_KEY, [...existing, propertyKey.toString()], ctor);
  };
}

export function getSensitiveFieldNames(entityClass: new (...args: unknown[]) => unknown): string[] {
  return (Reflect.getMetadata(SENSITIVE_METADATA_KEY, entityClass) as string[] | undefined) ?? [];
}
