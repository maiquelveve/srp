import { getSensitiveFieldNames } from '../common/decorators/sensitive.decorator';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { InviteToken } from '../users/entities/invite-token.entity';

/**
 * Static safety net in case an entity forgets the `@Sensitive()` decorator
 * (research.md #6, /speckit-analyze finding C1) — merged with every
 * `@Sensitive()`-marked field discovered across known entities.
 */
const DEFAULT_REDACTED_FIELDS = [
  'passwordHash',
  'tokenHash',
  'password',
  // Defense in depth: AuthController is @SkipAutoAudit()'d so these never
  // reach here via the generic interceptor, but any future code path that
  // logs a raw token payload must not leak it either.
  'accessToken',
  'refreshToken',
  'inviteToken',
];

const ENTITIES_WITH_SENSITIVE_FIELDS = [User, RefreshToken, InviteToken];

function buildRedactedFieldSet(): Set<string> {
  const fields = new Set(DEFAULT_REDACTED_FIELDS);
  for (const entityClass of ENTITIES_WITH_SENSITIVE_FIELDS) {
    for (const field of getSensitiveFieldNames(
      entityClass as unknown as new (...args: unknown[]) => unknown,
    )) {
      fields.add(field);
    }
  }
  return fields;
}

const REDACTED_FIELDS = buildRedactedFieldSet();
const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Replaces sensitive field values with a placeholder before persisting to
 * `audit_logs.old_data`/`new_data`. Applied at the top level and one level of
 * nesting, which covers every payload shape currently produced in this
 * codebase (Constitution II).
 */
export function redact(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!data) {
    return null;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_FIELDS.has(key)) {
      result[key] = REDACTED_PLACEHOLDER;
      continue;
    }
    if (value instanceof Date) {
      result[key] = value;
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redact(value as Record<string, unknown>);
      continue;
    }
    result[key] = value;
  }
  return result;
}
