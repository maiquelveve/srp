/**
 * mobile/src/lib/api-error.ts (T129, research.md #55): mostrar ao usuário a
 * mensagem que a API devolveu, em vez do texto fixo que descartava o motivo
 * real da recusa (ex.: "Cela de destino já está na capacidade máxima.").
 */
import { extractApiErrorMessage } from '../src/lib/api-error';

const fallbackMessage = 'Não foi possível concluir a operação. Tente novamente.';

describe('extractApiErrorMessage (T129)', () => {
  it('returns the API message when the response has a plain string message', () => {
    const error = {
      isAxiosError: true,
      response: { status: 409, data: { message: 'Cela de destino já está na capacidade máxima.' } },
    };

    expect(extractApiErrorMessage(error, fallbackMessage)).toBe(
      'Cela de destino já está na capacidade máxima.',
    );
  });

  it('returns the first item when the API message comes as a list', () => {
    const error = {
      isAxiosError: true,
      response: { status: 400, data: { message: ['reason não pode ficar em branco', 'outro erro'] } },
    };

    expect(extractApiErrorMessage(error, fallbackMessage)).toBe('reason não pode ficar em branco');
  });

  it('falls back when the API response has no usable message', () => {
    const error = { isAxiosError: true, response: { status: 500, data: {} } };

    expect(extractApiErrorMessage(error, fallbackMessage)).toBe(fallbackMessage);
  });

  it('falls back when there is no server response at all (network failure)', () => {
    const error = { isAxiosError: true, response: undefined };

    expect(extractApiErrorMessage(error, fallbackMessage)).toBe(fallbackMessage);
  });

  it('falls back for anything that is not an axios error', () => {
    expect(extractApiErrorMessage(new Error('boom'), fallbackMessage)).toBe(fallbackMessage);
    expect(extractApiErrorMessage('boom', fallbackMessage)).toBe(fallbackMessage);
    expect(extractApiErrorMessage(null, fallbackMessage)).toBe(fallbackMessage);
  });
});
