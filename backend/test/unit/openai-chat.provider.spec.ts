import { OpenAiChatProvider } from '../../src/ai/providers/openai-chat.provider';

describe('OpenAiChatProvider', () => {
  const provider = new OpenAiChatProvider({
    apiKey: 'sk-test',
    baseUrl: 'https://openai.test',
    model: 'gpt-4o-mini',
    timeoutMs: 1000,
  });
  const request = { systemPrompt: 'regras', userPrompt: 'pergunta' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the model id', () => {
    expect(provider.modelId).toBe('openai:gpt-4o-mini');
  });

  it('sends the key and the messages and returns the first choice', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'resposta' } }] })),
      );

    await expect(provider.generate(request)).resolves.toEqual({ text: 'resposta' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openai.test/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init?.body as string).messages).toEqual([
      { role: 'system', content: 'regras' },
      { role: 'user', content: 'pergunta' },
    ]);
  });

  it('rejects a response without choices', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [] })));

    await expect(provider.generate(request)).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });

  it('maps HTTP 401 to QUOTA_OR_AUTH', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(provider.generate(request)).rejects.toMatchObject({ kind: 'QUOTA_OR_AUTH' });
  });
});
