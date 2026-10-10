import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { AiProviderError } from '../ai-provider.error';
import { assertValidVectors, splitIntoBatches } from './embedding-batches';
import { postJson } from './http-json';

export interface OpenAiEmbeddingOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
  batchSize: number;
}

interface OpenAiEmbeddingsResponse {
  data?: Array<{ index: number; embedding: unknown }>;
}

/** Embeddings pela OpenAI: `POST {baseUrl}/v1/embeddings`. */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string;
  readonly dimensions: number;

  constructor(private readonly options: OpenAiEmbeddingOptions) {
    this.modelId = `openai:${options.model}`;
    this.dimensions = options.dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const batch of splitIntoBatches(texts, this.options.batchSize)) {
      const response = await postJson<OpenAiEmbeddingsResponse>({
        url: `${this.options.baseUrl}/v1/embeddings`,
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
        // `dimensions` faz o modelo devolver vetores do tamanho da coluna do banco.
        body: { model: this.options.model, input: batch, dimensions: this.dimensions },
        timeoutMs: this.options.timeoutMs,
      });
      if (!Array.isArray(response.data)) {
        throw new AiProviderError(
          'INVALID_RESPONSE',
          'Resposta de embeddings da OpenAI sem "data"',
        );
      }
      // A API devolve cada vetor com o índice do texto de origem; garante a ordem de entrada.
      const ordered = [...response.data].sort((first, second) => first.index - second.index);
      vectors.push(
        ...assertValidVectors(
          ordered.map((item) => item.embedding),
          batch.length,
          this.dimensions,
        ),
      );
    }
    return vectors;
  }
}
