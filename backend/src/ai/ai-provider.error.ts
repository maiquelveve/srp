/**
 * Tipos de falha de um provedor de IA. Todos os adapters traduzem os erros
 * do fornecedor (HTTP, rede, formato) para um destes, para o resto do sistema
 * tratar a falha sem saber qual fornecedor está por trás.
 */
export type AiProviderErrorKind =
  /** HTTP 429: limite de uso excedido. */
  | 'RATE_LIMIT'
  /** HTTP 401/402/403: chave inválida ou sem créditos. */
  | 'QUOTA_OR_AUTH'
  /** HTTP 5xx, conexão recusada, DNS. */
  | 'UNAVAILABLE'
  /** O provedor não respondeu dentro do tempo. */
  | 'TIMEOUT'
  /** Resposta fora do formato esperado (inclui vetor com dimensão errada). */
  | 'INVALID_RESPONSE';

export class AiProviderError extends Error {
  constructor(
    readonly kind: AiProviderErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
