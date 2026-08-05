import { SetMetadata } from '@nestjs/common';

export const SKIP_AUTO_AUDIT_KEY = 'audit:skipAuto';

/**
 * Excludes a controller/handler from the generic AuditInterceptor fallback
 * logging. Use when the response body contains sensitive material that must
 * never be auto-captured (tokens, credentials) — the service is expected to
 * call AuditService.record() itself with a safe, minimal payload instead.
 */
export const SkipAutoAudit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_AUTO_AUDIT_KEY, true);
