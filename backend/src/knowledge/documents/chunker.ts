/**
 * Divide o texto de um documento em trechos para vetorização (research.md #4).
 * Função pura: sem I/O, sem estado, fácil de testar.
 */

export interface ChunkOptions {
  /** Tamanho que cada trecho tenta atingir, em palavras (contando o overlap). */
  targetWords: number;
  /** Teto absoluto de palavras por trecho (contando o overlap). */
  maxWords: number;
  /** Quantas palavras do fim do trecho anterior são repetidas no início do próximo. */
  overlapWords: number;
}

export interface TextChunk {
  /** Ordem do trecho no documento, a partir de 0. */
  position: number;
  content: string;
  wordCount: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  targetWords: 400,
  maxWords: 500,
  overlapWords: 50,
};

/** Menor unidade que o chunker não parte: uma sentença (ou um pedaço de sentença gigante). */
interface Unit {
  words: string[];
  /** Verdadeiro para a primeira unidade de um parágrafo; vira linha em branco no texto final. */
  startsParagraph: boolean;
}

function splitIntoWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

/** Parágrafo (separado por linha em branco) → sentenças → unidades com no máximo `maxUnitWords`. */
function buildUnits(text: string, maxUnitWords: number, pieceWords: number): Unit[] {
  const units: Unit[] = [];
  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/(?<=[.!?…])\s+/);
    let isFirstOfParagraph = true;

    for (const sentence of sentences) {
      const words = splitIntoWords(sentence);
      if (words.length === 0) {
        continue;
      }
      // Sentença gigante (ex.: páginas sem ponto final): corta por palavras.
      const pieceSize = words.length > maxUnitWords ? pieceWords : words.length;
      for (let start = 0; start < words.length; start += pieceSize) {
        units.push({
          words: words.slice(start, start + pieceSize),
          startsParagraph: isFirstOfParagraph,
        });
        isFirstOfParagraph = false;
      }
    }
  }
  return units;
}

function assertValidOptions(options: ChunkOptions): void {
  const { targetWords, maxWords, overlapWords } = options;
  const isValid =
    targetWords > 0 && maxWords >= targetWords && overlapWords >= 0 && overlapWords < targetWords;
  if (!isValid) {
    throw new RangeError('Invalid chunk options: expect 0 <= overlap < target <= max');
  }
}

export function chunkText(
  text: string,
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): TextChunk[] {
  assertValidOptions(options);
  const { targetWords, maxWords, overlapWords } = options;

  const normalizedText = text.replace(/\r\n?/g, '\n').trim();
  if (normalizedText.length === 0) {
    return [];
  }

  // Depois do overlap, uma unidade precisa caber no trecho: por isso o limite é max - overlap.
  const maxUnitWords = maxWords - overlapWords;
  const units = buildUnits(normalizedText, maxUnitWords, targetWords);

  const chunks: TextChunk[] = [];
  let currentWords: string[] = []; // palavras do trecho em montagem (overlap + novas)
  let currentParts: string[] = []; // mesmo conteúdo, com as quebras de parágrafo
  let newWordCount = 0; // quantas palavras do trecho NÃO são overlap

  const closeChunk = (): void => {
    chunks.push({
      position: chunks.length,
      content: currentParts.join(''),
      wordCount: currentWords.length,
    });
    const overlap = overlapWords > 0 ? currentWords.slice(-overlapWords) : [];
    currentWords = [...overlap];
    currentParts = overlap.length > 0 ? [overlap.join(' ')] : [];
    newWordCount = 0;
  };

  for (const unit of units) {
    const wouldExceedMax = currentWords.length + unit.words.length > maxWords;
    if (newWordCount > 0 && (currentWords.length >= targetWords || wouldExceedMax)) {
      closeChunk();
    }
    const separator = currentParts.length === 0 ? '' : unit.startsParagraph ? '\n\n' : ' ';
    currentParts.push(separator + unit.words.join(' '));
    currentWords.push(...unit.words);
    newWordCount += unit.words.length;
  }

  // O que sobrou só vira trecho se tiver conteúdo novo (overlap sozinho seria duplicata).
  if (newWordCount > 0) {
    closeChunk();
  }
  return chunks;
}
