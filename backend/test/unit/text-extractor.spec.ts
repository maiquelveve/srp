import { readFileSync } from 'fs';
import { join } from 'path';
import { TextExtractionError, TextExtractor } from '../../src/knowledge/documents/text-extractor';

const FIXTURES_DIRECTORY = join(__dirname, '..', 'integration', 'fixtures', 'knowledge');

function fixture(fileName: string): Buffer {
  return readFileSync(join(FIXTURES_DIRECTORY, fileName));
}

describe('TextExtractor', () => {
  const extractor = new TextExtractor();

  it('lê TXT em UTF-8 preservando acentos', async () => {
    const text = await extractor.extract(fixture('sample.txt'), 'txt');

    expect(text).toContain('Procedimento de escolta hospitalar.');
    expect(text).toContain('ordem de saída');
  });

  it('remove o BOM e caracteres de controle de um TXT', async () => {
    const buffer = Buffer.from('﻿linha\u0000 com nulo', 'utf8');

    const text = await extractor.extract(buffer, 'txt');

    expect(text).toBe('linha  com nulo');
  });

  it('extrai o texto de um DOCX', async () => {
    const text = await extractor.extract(fixture('sample.docx'), 'docx');

    expect(text).toContain('Procedimento de escolta hospitalar');
    expect(text).toContain('O agente confere a ordem de saída.');
  });

  it('extrai o texto de um PDF sem o marcador de página da biblioteca', async () => {
    const text = await extractor.extract(fixture('with-text.pdf'), 'pdf');

    expect(text).toContain('Procedimento de escolta hospitalar');
    expect(text).not.toMatch(/-- \d+ of \d+ --/);
  });

  it('lança NO_EXTRACTABLE_TEXT para PDF sem texto (escaneado)', async () => {
    await expect(extractor.extract(fixture('no-text.pdf'), 'pdf')).rejects.toMatchObject({
      name: 'TextExtractionError',
      reason: 'NO_EXTRACTABLE_TEXT',
    });
  });

  it('lança NO_EXTRACTABLE_TEXT para TXT só com espaços', async () => {
    await expect(extractor.extract(Buffer.from('  \n\t  '), 'txt')).rejects.toMatchObject({
      reason: 'NO_EXTRACTABLE_TEXT',
    });
  });

  it('lança CORRUPTED_FILE para PDF corrompido', async () => {
    await expect(extractor.extract(fixture('corrupted.pdf'), 'pdf')).rejects.toMatchObject({
      reason: 'CORRUPTED_FILE',
    });
  });

  it('lança CORRUPTED_FILE para DOCX corrompido', async () => {
    await expect(extractor.extract(fixture('corrupted.docx'), 'docx')).rejects.toBeInstanceOf(
      TextExtractionError,
    );
    await expect(extractor.extract(fixture('corrupted.docx'), 'docx')).rejects.toMatchObject({
      reason: 'CORRUPTED_FILE',
    });
  });

  it('não vaza a mensagem da biblioteca nem o conteúdo no erro', async () => {
    const error = await extractor.extract(fixture('corrupted.pdf'), 'pdf').catch((e: Error) => e);

    expect((error as Error).message).toBe('Text extraction failed: CORRUPTED_FILE');
  });
});
