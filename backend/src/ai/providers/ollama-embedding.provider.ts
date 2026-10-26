import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { assertValidVectors, splitIntoBatches } from './embedding-batches';
import { postJson } from './http-json';

export interface OllamaEmbeddingOptions {
  baseUrl: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
  batchSize: number;
}

interface OllamaEmbedResponse {
  embeddings?: unknown;
}

/** Embeddings pelo Ollama local: `POST {baseUrl}/api/embed`. */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string;
  readonly dimensions: number;

  constructor(private readonly options: OllamaEmbeddingOptions) {
    this.modelId = `ollama:${options.model}`;
    this.dimensions = options.dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const batch of splitIntoBatches(texts, this.options.batchSize)) {
      const response = await postJson<OllamaEmbedResponse>({
        url: `${this.options.baseUrl}/api/embed`,
        body: { model: this.options.model, input: batch },
        timeoutMs: this.options.timeoutMs,
      });
      vectors.push(...assertValidVectors(response.embeddings, batch.length, this.dimensions));
    }
    return vectors;
  }
}
