export type UnauthorizedOutcome = 'retry-with-refresh' | 'session-expired' | 'not-unauthorized';

/**
 * Decide o que fazer com a resposta de um pedido: renovar o token na
 * primeira vez que ele vem 401, ou considerar a sessão encerrada pelo
 * servidor quando o retry com o token já renovado também volta 401 (o
 * servidor recusou a sessão em si, não só o token vencido — ex.: usuário
 * desativado, T128, research.md #55). Função pura, sem axios, pra dar pra
 * testar sem simular o cliente HTTP inteiro.
 */
export function classifyUnauthorizedResponse(
  status: number | undefined,
  alreadyRetried: boolean,
): UnauthorizedOutcome {
  if (status !== 401) return 'not-unauthorized';
  return alreadyRetried ? 'session-expired' : 'retry-with-refresh';
}
