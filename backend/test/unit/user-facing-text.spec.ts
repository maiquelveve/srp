import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Regra do projeto: texto que chega ao usuário não usa travessão longo (usar
 * frases separadas ou dois pontos). Comentários de código ficam de fora.
 */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('user-facing text', () => {
  it('has no em dash in backend strings (comments excluded)', () => {
    const offenders = sourceFiles(join(__dirname, '../../src')).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ file, line: line.trim(), number: index + 1 }))
        .filter(
          ({ line }) =>
            line.includes('—') &&
            !line.startsWith('//') &&
            !line.startsWith('*') &&
            !line.startsWith('/*'),
        )
        .map(({ file: path, number, line }) => `${path}:${number}: ${line}`),
    );

    expect(offenders).toEqual([]);
  });
});
