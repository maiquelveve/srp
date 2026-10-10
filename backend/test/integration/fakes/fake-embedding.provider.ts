import { AiProviderError, AiProviderErrorKind } from '../../../src/ai/ai-provider.error';
import { EmbeddingProvider } from '../../../src/ai/interfaces/embedding-provider.interface';

/**
 * EmbeddingProvider de teste: determinístico e sem rede. Cada palavra do texto
 * soma 1 em uma posição do vetor (escolhida por hash da palavra), e o vetor é
 * normalizado. Resultado: textos que compartilham palavras ficam mais próximos
 * por cosseno, o suficiente para testar recuperação sem um modelo real.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string;
  /** Cada chamada a `embed`, na ordem; permite conferir lotes e textos enviados. */
  readonly calls: string[][] = [];
  private failureKind: AiProviderErrorKind | null = null;

  constructor(
    readonly dimensions = 1024,
    modelId = 'fake:embedding',
  ) {
    this.modelId = modelId;
  }

  /** As próximas chamadas a `embed` falham com este tipo de erro, até `reset()`. */
  failWith(kind: AiProviderErrorKind): void {
    this.failureKind = kind;
  }

  reset(): void {
    this.failureKind = null;
    this.calls.length = 0;
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push([...texts]);
    if (this.failureKind) {
      throw new AiProviderError(this.failureKind, 'Falha simulada do provedor de embeddings');
    }
    return texts.map((text) => this.vectorFor(text));
  }

  private vectorFor(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const word of words) {
      vector[this.hash(word) % this.dimensions] += 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) {
      vector[0] = 1;
      return vector;
    }
    return vector.map((value) => value / norm);
  }

  private hash(word: string): number {
    let hash = 5381;
    for (const character of word) {
      hash = (hash * 33 + character.codePointAt(0)!) >>> 0;
    }
    return hash;
  }
}
