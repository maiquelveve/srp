/**
 * Jest `setupFiles` entry — runs before any test file (and its imports) load,
 * so this must be the first thing to touch `POSTGRES_DB`, before
 * `data-source.ts` reads it at import time (research.md #1: isolated test DB).
 */
process.env.POSTGRES_DB = 'srp_db_test';
