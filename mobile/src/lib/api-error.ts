import axios from 'axios';

/**
 * Extrai a mensagem de erro devolvida pela API (contracts REST do backend
 * padronizam `{ message: string | string[] }`, T126/research.md #55) — a
 * lista aparece em erros de validação, e o primeiro item já basta pro
 * usuário entender o que corrigir. Sem resposta do servidor (falha de rede)
 * ou sem `message` utilizável, devolve o texto genérico informado por quem
 * chama, em vez de expor detalhe técnico.
 */
export function extractApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (!axios.isAxiosError(error)) return fallbackMessage;

  const responseData = error.response?.data as { message?: string | string[] } | undefined;
  const message = responseData?.message;

  if (Array.isArray(message)) {
    const firstMessage = message[0];
    return typeof firstMessage === 'string' && firstMessage.trim() !== '' ? firstMessage : fallbackMessage;
  }

  if (typeof message === 'string' && message.trim() !== '') {
    return message;
  }

  return fallbackMessage;
}
