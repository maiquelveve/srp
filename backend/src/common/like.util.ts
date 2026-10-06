/** Escapa `%`, `_` e `\` para o texto digitado valer literalmente num `ILIKE`. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}
