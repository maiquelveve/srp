/** Motivos de falha devolvidos pelo backend, na linguagem de quem usa a tela. */
const FAILURE_REASON_LABEL: Record<string, string> = {
  NO_EXTRACTABLE_TEXT: 'O arquivo não tem texto que possa ser lido (pode ser um PDF escaneado).',
  CORRUPTED_FILE: 'O arquivo está corrompido ou não pôde ser aberto.',
  AI_UNAVAILABLE: 'O serviço de IA estava indisponível. Tente reprocessar mais tarde.',
  INTERRUPTED: 'O processamento foi interrompido. Tente reprocessar.',
  UNKNOWN: 'Erro inesperado ao processar o documento.',
};

export function describeFailure(code: string | null): string {
  // Um código novo no backend, ainda não mapeado aqui, cai no texto genérico.
  return FAILURE_REASON_LABEL[code ?? 'UNKNOWN'] ?? FAILURE_REASON_LABEL.UNKNOWN;
}
