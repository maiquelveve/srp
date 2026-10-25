import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Regra do projeto: texto que chega ao usuário não usa travessão longo (usar
 * frases separadas ou dois pontos). Comentários de código ficam de fora.
 */
function sourceFiles(directory: string, extensions = ['.ts']): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path, extensions);
    return extensions.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}

/** Linhas com travessão que não são comentário (`//`, `*`, `/*` ou `{/*` de JSX). */
function emDashLines(files: string[]): string[] {
  return files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line, index) => ({ file, line: line.trim(), number: index + 1 }))
      .filter(
        ({ line }) =>
          line.includes('—') &&
          !line.startsWith('//') &&
          !line.startsWith('*') &&
          !line.startsWith('/*') &&
          !line.startsWith('{/*'),
      )
      .map(({ file: path, number, line }) => `${path}:${number}: ${line}`),
  );
}

describe('user-facing text', () => {
  it('has no em dash in backend strings (comments excluded)', () => {
    expect(emDashLines(sourceFiles(join(__dirname, '../../src')))).toEqual([]);
  });

  // Só a feature da base de conhecimento: o resto do frontend ainda tem travessões antigos
  // (ex.: HelpPage) que não cabem a esta feature corrigir.
  it('has no em dash in the knowledge base frontend strings (comments excluded)', () => {
    const directory = join(__dirname, '../../../frontend/src/features/knowledge-base');
    expect(emDashLines(sourceFiles(directory, ['.ts', '.tsx']))).toEqual([]);
  });
});
