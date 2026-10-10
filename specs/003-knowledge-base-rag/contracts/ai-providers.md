# Contract: Camada de provedores de IA (`backend/src/ai/`)

Contratos internos (não são endpoints HTTP). Nenhuma regra de negócio vive aqui; nenhum SDK de IA é usado, só `fetch`.

## Interfaces

```ts
export interface EmbeddingProvider {
  /** Identificador gravado em knowledge_document_chunks.embedding_model, ex.: "ollama:bge-m3". */
  readonly modelId: string;
  /** Deve ser igual a EMBEDDING_DIMENSIONS e à coluna vector(N). */
  readonly dimensions: number;
  /** Mantém a ordem da entrada; cada vetor tem `dimensions` posições. Lança AiProviderError. */
  embed(texts: string[]): Promise<number[][]>;
}

export interface ChatRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface ChatProvider {
  readonly modelId: string;
  /** Resposta final em texto. Sem streaming nesta fase. Lança AiProviderError. */
  generate(request: ChatRequest): Promise<{ text: string }>;
}
```

## Erro padronizado

```ts
export type AiProviderErrorKind =
  | 'RATE_LIMIT'      // HTTP 429
  | 'QUOTA_OR_AUTH'   // 401/402/403, sem créditos, chave inválida
  | 'UNAVAILABLE'     // 5xx, conexão recusada, DNS
  | 'TIMEOUT'         // AbortSignal.timeout
  | 'INVALID_RESPONSE'; // corpo fora do esperado, dimensão divergente

export class AiProviderError extends Error {
  constructor(readonly kind: AiProviderErrorKind, message: string, readonly cause?: unknown) {}
}
```

Os adapters NUNCA deixam vazar a chave de API nem o corpo da resposta na mensagem do erro.

## Implementações

| Token | `EMBEDDING_PROVIDER` / `CHAT_PROVIDER` | Classe | Endpoint chamado |
|---|---|---|---|
| `EmbeddingProvider` | `ollama` | `OllamaEmbeddingProvider` | `POST {OLLAMA_BASE_URL}/api/embed` |
| `EmbeddingProvider` | `openai` | `OpenAiEmbeddingProvider` | `POST {OPENAI_BASE_URL}/v1/embeddings` (`dimensions` = `EMBEDDING_DIMENSIONS`) |
| `ChatProvider` | `ollama` | `OllamaChatProvider` | `POST {OLLAMA_BASE_URL}/api/chat` (`stream: false`) |
| `ChatProvider` | `openai` | `OpenAiChatProvider` | `POST {OPENAI_BASE_URL}/v1/chat/completions` |
| `ChatProvider` | `claude` | `ClaudeChatProvider` | `POST {ANTHROPIC_BASE_URL}/v1/messages` |

## Factory e injeção

```ts
// ai.tokens.ts
export const EMBEDDING_PROVIDER = 'EmbeddingProvider';
export const CHAT_PROVIDER = 'ChatProvider';

// ai.module.ts
{ provide: EMBEDDING_PROVIDER, inject: [APP_CONFIG], useFactory: (config: AppConfig): EmbeddingProvider => { /* switch por config.ai.embeddingProvider */ } }
{ provide: CHAT_PROVIDER,      inject: [APP_CONFIG], useFactory: (config: AppConfig): ChatProvider      => { /* switch por config.ai.chatProvider */ } }

// consumo
constructor(@Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider) {}
```

Valor desconhecido de provider ou credencial ausente para `openai`/`claude` → `Error` na fábrica (o backend não sobe, FR-030).

## Variáveis de ambiente

| Variável | Default | Observação |
|---|---|---|
| `EMBEDDING_PROVIDER` | `ollama` | `ollama` \| `openai` |
| `CHAT_PROVIDER` | `ollama` | `ollama` \| `openai` \| `claude` |
| `EMBEDDING_DIMENSIONS` | `1024` | Deve bater com a coluna; validado no boot |
| `AI_EMBEDDING_TIMEOUT_MS` / `AI_CHAT_TIMEOUT_MS` | `30000` / `60000` | |
| `AI_EMBEDDING_BATCH_SIZE` | `16` | |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | |
| `OLLAMA_EMBEDDING_MODEL` / `OLLAMA_CHAT_MODEL` | `bge-m3` / `qwen2.5:7b-instruct` | |
| `OPENAI_API_KEY` | — | obrigatório se algum provider for `openai` |
| `OPENAI_EMBEDDING_MODEL` / `OPENAI_CHAT_MODEL` | `text-embedding-3-small` / `gpt-4o-mini` | |
| `ANTHROPIC_API_KEY` | — | obrigatório se `CHAT_PROVIDER=claude` |
| `ANTHROPIC_CHAT_MODEL` | `claude-sonnet-5-5` | |

Os modelos padrão são ponto de partida; a escolha final é validada pelo quickstart.
