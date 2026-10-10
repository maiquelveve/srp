import { AiProviderError } from '../ai-provider.error';

/** Divide a lista em lotes de no máximo `batchSize` itens, preservando a ordem. */
export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += batchSize) {
    batches.push(items.slice(start, start + batchSize));
  }
  return batches;
}

/**
 * Confere o que o provedor devolveu: um vetor por texto enviado, cada um com
 * exatamente `dimensions` posições. Dimensão errada nunca pode chegar ao banco.
 */
export function assertValidVectors(
  vectors: unknown,
  expectedCount: number,
  dimensions: number,
): number[][] {
  const isListOfVectors = Array.isArray(vectors) && vectors.length === expectedCount;
  const hasExpectedShape =
    isListOfVectors &&
    (vectors as unknown[]).every(
      (vector) =>
        Array.isArray(vector) &&
        vector.length === dimensions &&
        vector.every((value) => typeof value === 'number'),
    );
  if (!hasExpectedShape) {
    throw new AiProviderError(
      'INVALID_RESPONSE',
      `O provedor de embeddings devolveu vetores fora do esperado (${expectedCount} vetores de ${dimensions} posições)`,
    );
  }
  return vectors as number[][];
}
