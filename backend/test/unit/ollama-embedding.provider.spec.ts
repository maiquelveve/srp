import { OllamaEmbeddingProvider } from '../../src/ai/providers/ollama-embedding.provider';

const DIMENSIONS = 4;

function vectorOf(value: number): number[] {
  return Array.from({ length: DIMENSIONS }, () => value);
}

function okResponse(embeddings: unknown): Response {
  return new Response(JSON.stringify({ embeddings }), { status: 200 });
}

describe('OllamaEmbeddingProvider', () => {
  const provider = new OllamaEmbeddingProvider({
    baseUrl: 'http://ollama.test',
    model: 'bge-m3',
    dimensions: DIMENSIONS,
    timeoutMs: 1000,
    batchSize: 2,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the model id and dimensions', () => {
    expect(provider.modelId).toBe('ollama:bge-m3');
    expect(provider.dimensions).toBe(DIMENSIONS);
  });

  it('calls /api/embed with the model and returns the vectors', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse([vectorOf(0.1), vectorOf(0.2)]));

    const vectors = await provider.embed(['a', 'b']);

    expect(vectors).toEqual([vectorOf(0.1), vectorOf(0.2)]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ollama.test/api/embed');
    expect(JSON.parse(init?.body as string)).toEqual({ model: 'bge-m3', input: ['a', 'b'] });
  });

  it('splits the texts into batches and keeps the input order', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(okResponse([vectorOf(1), vectorOf(2)]))
      .mockResolvedValueOnce(okResponse([vectorOf(3)]));

    const vectors = await provider.embed(['a', 'b', 'c']);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vectors).toEqual([vectorOf(1), vectorOf(2), vectorOf(3)]);
  });

  it('returns an empty list without calling the provider when there is no text', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(provider.embed([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects vectors with the wrong dimension', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(okResponse([[0.1, 0.2]]));

    await expect(provider.embed(['a'])).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });

  it('rejects a response with a different number of vectors than texts', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(okResponse([vectorOf(1)]));

    await expect(provider.embed(['a', 'b'])).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });

  it('propagates provider failures as AiProviderError', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));

    await expect(provider.embed(['a'])).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });
});
