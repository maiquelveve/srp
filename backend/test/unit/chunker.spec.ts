import { chunkText, DEFAULT_CHUNK_OPTIONS } from '../../src/knowledge/documents/chunker';

/** Gera `count` palavras numeradas (w0 w1 ...), para localizar cada uma nos trechos. */
function words(count: number, startAt = 0): string[] {
  return Array.from({ length: count }, (_, index) => `w${startAt + index}`);
}

/** Sentenças de 10 palavras terminadas em ponto: `sentenceCount` * 10 palavras no total. */
function sentences(sentenceCount: number): string {
  return Array.from({ length: sentenceCount }, (_, index) => {
    const sentenceWords = words(10, index * 10);
    return `${sentenceWords.join(' ')}.`;
  }).join(' ');
}

function wordsOf(content: string): string[] {
  return content.split(/\s+/).filter((word) => word.length > 0);
}

describe('chunkText', () => {
  it('devolve lista vazia para texto vazio ou só espaços', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  \t ')).toEqual([]);
  });

  it('mantém texto curto em um único trecho', () => {
    const chunks = chunkText('Procedimento de escolta. O agente confere a ordem.');

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ position: 0, wordCount: 8 });
    expect(chunks[0].content).toBe('Procedimento de escolta. O agente confere a ordem.');
  });

  it('respeita alvo e máximo e numera as posições em ordem', () => {
    const chunks = chunkText(sentences(250)); // 2500 palavras

    expect(chunks.length).toBeGreaterThan(4);
    chunks.forEach((chunk, index) => {
      expect(chunk.position).toBe(index);
      expect(chunk.wordCount).toBeLessThanOrEqual(DEFAULT_CHUNK_OPTIONS.maxWords);
      expect(wordsOf(chunk.content)).toHaveLength(chunk.wordCount);
    });
    // Todos, menos o último, chegam ao alvo.
    chunks.slice(0, -1).forEach((chunk) => {
      expect(chunk.wordCount).toBeGreaterThanOrEqual(DEFAULT_CHUNK_OPTIONS.targetWords);
    });
  });

  it('repete as últimas 50 palavras de um trecho no início do seguinte', () => {
    const chunks = chunkText(sentences(250));

    for (let index = 1; index < chunks.length; index += 1) {
      const previousWords = wordsOf(chunks[index - 1].content);
      const currentWords = wordsOf(chunks[index].content);
      expect(currentWords.slice(0, 50)).toEqual(previousWords.slice(-50));
    }
  });

  it('não perde nenhuma palavra do texto original', () => {
    const original = words(1234);
    const chunks = chunkText(original.join(' '));

    const seen = new Set(chunks.flatMap((chunk) => wordsOf(chunk.content)));
    original.forEach((word) => expect(seen.has(word)).toBe(true));
  });

  it('corta por palavras uma sentença maior que o máximo, sem passar do teto', () => {
    const giantSentence = words(1300).join(' '); // sem pontuação
    const chunks = chunkText(giantSentence);

    expect(chunks.length).toBeGreaterThan(2);
    chunks.forEach((chunk) => {
      expect(chunk.wordCount).toBeLessThanOrEqual(DEFAULT_CHUNK_OPTIONS.maxWords);
    });
    const seen = new Set(chunks.flatMap((chunk) => wordsOf(chunk.content)));
    expect(seen.size).toBe(1300);
  });

  it('preserva a quebra de parágrafo dentro do trecho', () => {
    const chunks = chunkText('Primeiro parágrafo aqui.\n\nSegundo parágrafo aqui.');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Primeiro parágrafo aqui.\n\nSegundo parágrafo aqui.');
  });

  it('trata quebra de linha simples (texto com largura fixa) como espaço', () => {
    const chunks = chunkText('linha um\nlinha dois\r\nlinha três');

    expect(chunks[0].content).toBe('linha um linha dois linha três');
  });

  it('não emite um trecho que seria só o overlap do anterior', () => {
    // 450 palavras: o primeiro trecho fecha por tamanho e nada novo sobra.
    const chunks = chunkText(sentences(45));

    expect(chunks.every((chunk) => chunk.wordCount > 0)).toBe(true);
    const lastWords = wordsOf(chunks[chunks.length - 1].content);
    expect(lastWords.length).toBeGreaterThan(0);
    expect(chunks).toHaveLength(2); // 400 + (50 overlap + 50 novas)
  });

  it('rejeita opções incoerentes', () => {
    expect(() => chunkText('texto', { targetWords: 100, maxWords: 50, overlapWords: 10 })).toThrow(
      RangeError,
    );
    expect(() =>
      chunkText('texto', { targetWords: 100, maxWords: 200, overlapWords: 100 }),
    ).toThrow(RangeError);
  });
});
