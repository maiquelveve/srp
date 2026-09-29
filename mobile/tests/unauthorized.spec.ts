/**
 * mobile/src/lib/unauthorized.ts, usado pelo interceptor de
 * mobile/src/services/api-client.ts (T128, research.md #55): decide se um
 * 401 deve tentar renovar o token (primeira vez) ou se a sessão foi mesmo
 * encerrada pelo servidor (retry com token já renovado também voltou 401 —
 * ex.: usuário desativado). Só a decisão pura, sem simular o axios inteiro.
 */
import { classifyUnauthorizedResponse } from '../src/lib/unauthorized';

describe('classifyUnauthorizedResponse (T128)', () => {
  it('ignores any status that is not 401', () => {
    expect(classifyUnauthorizedResponse(404, false)).toBe('not-unauthorized');
    expect(classifyUnauthorizedResponse(500, false)).toBe('not-unauthorized');
    expect(classifyUnauthorizedResponse(undefined, false)).toBe('not-unauthorized');
  });

  it('asks to retry with a refreshed token on the first 401', () => {
    expect(classifyUnauthorizedResponse(401, false)).toBe('retry-with-refresh');
  });

  it('treats a 401 on the already-retried request as a server-side session end', () => {
    expect(classifyUnauthorizedResponse(401, true)).toBe('session-expired');
  });
});
