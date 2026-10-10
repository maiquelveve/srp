import { AiProviderError } from '../../src/ai/ai-provider.error';
import { postJson } from '../../src/ai/providers/http-json';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('postJson', () => {
  const options = {
    url: 'http://ai.test/api',
    body: { question: 'pergunta secreta' },
    headers: { Authorization: 'Bearer chave-secreta' },
    timeoutMs: 1000,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the parsed JSON body and sends the headers', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(200, { ok: 1 }));

    await expect(postJson<{ ok: number }>(options)).resolves.toEqual({ ok: 1 });

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer chave-secreta');
    expect(init?.method).toBe('POST');
  });

  it.each([
    [429, 'RATE_LIMIT'],
    [401, 'QUOTA_OR_AUTH'],
    [402, 'QUOTA_OR_AUTH'],
    [403, 'QUOTA_OR_AUTH'],
    [500, 'UNAVAILABLE'],
    [503, 'UNAVAILABLE'],
    [400, 'INVALID_RESPONSE'],
    [404, 'INVALID_RESPONSE'],
  ])('maps HTTP %i to %s', async (status, expectedKind) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(status, { error: 'x' }));

    await expect(postJson(options)).rejects.toMatchObject({ kind: expectedKind });
  });

  it('maps a network failure to UNAVAILABLE', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    await expect(postJson(options)).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });

  it('maps a timeout to TIMEOUT', async () => {
    const timeoutError = new Error('timed out');
    timeoutError.name = 'TimeoutError';
    jest.spyOn(global, 'fetch').mockRejectedValue(timeoutError);

    await expect(postJson(options)).rejects.toMatchObject({ kind: 'TIMEOUT' });
  });

  it('maps a non-JSON body to INVALID_RESPONSE', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('<html>', { status: 200 }));

    await expect(postJson(options)).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });

  it('never leaks the question, the body or the API key in the error message', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse(401, { error: 'chave-secreta pergunta secreta' }));

    const error = await postJson(options).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiProviderError);
    const message = (error as AiProviderError).message;
    expect(message).not.toContain('chave-secreta');
    expect(message).not.toContain('pergunta secreta');
  });
});
