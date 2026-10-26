import { AiProviderError, AiProviderErrorKind } from '../ai-provider.error';

export interface PostJsonOptions {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
  timeoutMs: number;
}

/** Traduz o status HTTP de uma resposta de erro para o tipo de falha padronizado. */
function kindForStatus(status: number): AiProviderErrorKind {
  if (status === 429) {
    return 'RATE_LIMIT';
  }
  if (status === 401 || status === 402 || status === 403) {
    return 'QUOTA_OR_AUTH';
  }
  if (status >= 500) {
    return 'UNAVAILABLE';
  }
  return 'INVALID_RESPONSE';
}

/**
 * POST com corpo JSON que devolve o JSON da resposta. Qualquer falha vira
 * `AiProviderError`. As mensagens de erro NUNCA incluem cabeçalhos (chave de
 * API) nem o corpo enviado ou recebido (pergunta, trechos): só o status.
 */
export async function postJson<TResponse>(options: PostJsonOptions): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(options.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    if (isTimeout) {
      throw new AiProviderError('TIMEOUT', 'O provedor de IA não respondeu a tempo', error);
    }
    throw new AiProviderError('UNAVAILABLE', 'Não foi possível conectar ao provedor de IA', error);
  }

  if (!response.ok) {
    throw new AiProviderError(
      kindForStatus(response.status),
      `O provedor de IA respondeu com o status ${response.status}`,
    );
  }

  try {
    return (await response.json()) as TResponse;
  } catch (error) {
    throw new AiProviderError(
      'INVALID_RESPONSE',
      'O provedor de IA devolveu uma resposta que não é JSON',
      error,
    );
  }
}
