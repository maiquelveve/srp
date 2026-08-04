import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../types/jwt-payload.type';

/**
 * Rejects access to a `:unitId` route param outside the caller's vinculated
 * units (FR-004a). Applied only to routes with a `:unitId` path param (e.g.
 * `GET /units/:unitId/galleries`); list-endpoint scope filtering (queries
 * with no explicit unitId) is each service's own responsibility — see
 * contracts/structure.md.
 */
@Injectable()
export class UnitScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload; params: Record<string, string> }>();

    const unitIdParam = request.params.unitId;
    if (!unitIdParam) {
      return true;
    }

    const unitId = Number(unitIdParam);
    if (!request.user || !request.user.units.includes(unitId)) {
      throw new ForbiddenException('Fora do escopo de unidade do usuário');
    }

    return true;
  }
}
