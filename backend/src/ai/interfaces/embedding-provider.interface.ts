/**
 * Transforma textos em vetores numéricos. Textos com assunto parecido geram
 * vetores próximos, o que permite buscar trechos por significado.
 */
export interface EmbeddingProvider {
  /** Identificador gravado junto de cada vetor, ex.: "ollama:bge-m3". */
  readonly modelId: string;
  /** Tamanho de cada vetor; igual a EMBEDDING_DIMENSIONS e à coluna vector(N). */
  readonly dimensions: number;
  /**
   * Um vetor por texto, na mesma ordem da entrada. Lança `AiProviderError`.
   */
  embed(texts: string[]): Promise<number[][]>;
}
