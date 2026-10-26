import { ClaudeChatProvider } from '../../src/ai/providers/claude-chat.provider';

describe('ClaudeChatProvider', () => {
  const provider = new ClaudeChatProvider({
    apiKey: 'sk-ant-test',
    baseUrl: 'https://anthropic.test',
    model: 'claude-sonnet-5-5',
    timeoutMs: 1000,
  });
  const request = { systemPrompt: 'regras', userPrompt: 'pergunta' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the model id', () => {
    expect(provider.modelId).toBe('claude:claude-sonnet-5-5');
  });

  it('sends the key, the version header and the system prompt apart from the messages', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            { type: 'text', text: 'resposta ' },
            { type: 'text', text: 'completa' },
          ],
        }),
      ),
    );

    await expect(provider.generate(request)).resolves.toEqual({ text: 'resposta completa' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://anthropic.test/v1/messages');
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init?.body as string);
    expect(body.system).toBe('regras');
    expect(body.messages).toEqual([{ role: 'user', content: 'pergunta' }]);
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  it('ignores non-text blocks and rejects when no text remains', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'tool_use' }] })));

    await expect(provider.generate(request)).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });

  it('maps HTTP 429 to RATE_LIMIT', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 429 }));

    await expect(provider.generate(request)).rejects.toMatchObject({ kind: 'RATE_LIMIT' });
  });
});
