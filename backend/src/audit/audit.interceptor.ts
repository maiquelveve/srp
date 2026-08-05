import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';
import { AUDIT_RESOURCE_KEY } from '../common/decorators/audit-resource.decorator';
import { SKIP_AUTO_AUDIT_KEY } from '../common/decorators/skip-auto-audit.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function actionForMethod(method: string): AuditAction {
  if (method === 'POST') return AuditAction.INSERT;
  if (method === 'DELETE') return AuditAction.DELETE;
  return AuditAction.UPDATE;
}

function inferResourceFromUrl(url: string): string | null {
  // e.g. /api/v1/users/42/deactivate -> "users"
  const match = /^\/api\/v1\/([a-zA-Z-]+)/.exec(url);
  return match ? match[1] : null;
}

function extractRecordId(responseBody: unknown, params: Record<string, string>): number | null {
  const body = responseBody as { id?: number } | undefined;
  if (body && typeof body.id === 'number') {
    return body.id;
  }
  const paramId = params.id;
  return paramId ? Number(paramId) || null : null;
}

/**
 * Global write-path audit trail (Constitution III). Every successful
 * POST/PUT/PATCH/DELETE gets a redacted `audit_logs` entry automatically.
 * `oldData` is `null` here by default — services with the previous state in
 * hand (e.g. UsersService.deactivate) call `AuditService.record()` directly
 * with a full before/after snapshot instead, and mark the handler/controller
 * `@SkipAutoAudit()` so this interceptor does not also log the raw response
 * (critical for AuthController, whose response bodies carry live tokens —
 * auto-logging them would leak a usable refresh token into audit_logs).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();

    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }

    const skipAutoAudit = this.reflector.getAllAndOverride<boolean>(SKIP_AUTO_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAutoAudit) {
      return next.handle();
    }

    const resource =
      this.reflector.get<string>(AUDIT_RESOURCE_KEY, context.getHandler()) ??
      this.reflector.get<string>(AUDIT_RESOURCE_KEY, context.getClass()) ??
      inferResourceFromUrl(request.originalUrl);

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        void this.auditService.record({
          userId: request.user?.sub ?? null,
          affectedTable: resource,
          recordId: extractRecordId(responseBody, request.params),
          action: actionForMethod(request.method),
          oldData: null,
          newData: responseBody as Record<string, unknown> | null,
        });
      }),
    );
  }
}
