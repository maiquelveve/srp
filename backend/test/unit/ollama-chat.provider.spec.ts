import { OllamaChatProvider } from '../../src/ai/providers/ollama-chat.provider';

describe('OllamaChatProvider', () => {
  const provider = new OllamaChatProvider({
    baseUrl: 'http://ollama.test',
    model: 'qwen2.5:7b-instruct',
    numCtx: 8192,
    timeoutMs: 1000,
  });
  const request = { systemPrompt: 'regras', userPrompt: 'pergunta' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the model id', () => {
    expect(provider.modelId).toBe('ollama:qwen2.5:7b-instruct');
  });

  it('sends the messages with num_ctx and returns the text', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { role: 'assistant', content: 'resposta' } })),
      );

    await expect(provider.generate(request)).resolves.toEqual({ text: 'resposta' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ollama.test/api/chat');
    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe('qwen2.5:7b-instruct');
    expect(body.stream).toBe(false);
    expect(body.options.num_ctx).toBe(8192);
    expect(body.messages).toEqual([
      { role: 'system', content: 'regras' },
      { role: 'user', content: 'pergunta' },
    ]);
  });

  it('rejects an empty answer', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: { content: '  ' } })));

    await expect(provider.generate(request)).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });

  it('maps a connection failure to UNAVAILABLE', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    await expect(provider.generate(request)).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });
});
