/**
 * mobile/src/lib/list-load-state.ts (T130, research.md #55): distinguir
 * carregando, erro de verdade e vazio de verdade nas telas de lista — antes
 * uma falha de carga virava "nenhum preso"/"nenhuma galeria cadastrada".
 */
import { resolveListLoadState } from '../src/lib/list-load-state';

describe('resolveListLoadState (T130)', () => {
  it('is "loading" on the very first fetch, with no cached data yet', () => {
    expect(resolveListLoadState({ isLoading: true, isError: false, hasData: false, isEmpty: true })).toBe(
      'loading',
    );
  });

  it('is "error" when it failed and there is no cached data to fall back to', () => {
    expect(resolveListLoadState({ isLoading: false, isError: true, hasData: false, isEmpty: true })).toBe(
      'error',
    );
  });

  it('is "offline-with-data" when a refetch failed but a previous successful fetch left data cached', () => {
    expect(resolveListLoadState({ isLoading: false, isError: true, hasData: true, isEmpty: false })).toBe(
      'offline-with-data',
    );
  });

  it('prefers "error" over "loading" — a failed cache-less refetch is not a loading state', () => {
    expect(resolveListLoadState({ isLoading: true, isError: true, hasData: false, isEmpty: true })).toBe(
      'error',
    );
  });

  it('is "empty" only once loaded successfully with truly no items', () => {
    expect(resolveListLoadState({ isLoading: false, isError: false, hasData: true, isEmpty: true })).toBe(
      'empty',
    );
  });

  it('is "ready" once loaded successfully with items', () => {
    expect(resolveListLoadState({ isLoading: false, isError: false, hasData: true, isEmpty: false })).toBe(
      'ready',
    );
  });
});
