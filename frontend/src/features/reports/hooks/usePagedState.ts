import { useState } from 'react';

/** Itens por página nas listas dos relatórios. */
export const REPORT_PAGE_SIZE = 10;

/**
 * Página atual (a partir de 0) atrelada a uma assinatura dos filtros: quando
 * qualquer filtro muda, `filterKey` muda e a página volta para 0 na mesma
 * renderização, sem disparar uma busca com a página antiga.
 */
export function usePagedState(filterKey: string): [number, (page: number) => void] {
  const [state, setState] = useState({ filterKey, page: 0 });
  const page = state.filterKey === filterKey ? state.page : 0;
  return [page, (next) => setState({ filterKey, page: next })];
}
