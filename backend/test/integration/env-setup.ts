/**
 * Jest `setupFiles` entry — runs before any test file (and its imports) load,
 * so this must be the first thing to touch `POSTGRES_DB`, before
 * `data-source.ts` reads it at import time (research.md #1: isolated test DB).
 */
process.env.POSTGRES_DB = 'srp_db_test';
// Mesma ideia pro storage de documentos (feature 002, Phase 4) — sem isso,
// os uploads da suíte de testes cairiam no mesmo diretório usado pelo
// `npm run start:dev`, poluindo o storage de desenvolvimento.
process.env.DOCUMENTS_STORAGE_PATH = './storage/documents-test';
// Baixo de propósito — deixa o teste de 413 (tamanho máximo) rápido e leve,
// sem precisar gerar um arquivo de dezenas de MB; os arquivos de teste reais
// usados nos outros casos têm poucos bytes, bem abaixo de 1 MB.
process.env.DOCUMENTS_MAX_FILE_SIZE_MB = '1';
