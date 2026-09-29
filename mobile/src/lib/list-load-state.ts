export type ListLoadState = 'loading' | 'error' | 'offline-with-data' | 'empty' | 'ready';

/**
 * Resolve o estado de uma lista carregada via React Query (T130,
 * research.md #55) — sem isso, cada tela só olhava `isLoading`, então uma
 * falha de rede virava "nenhum preso"/"nenhuma galeria", indistinguível de
 * uma lista de verdade vazia.
 *
 * - `error`: falhou e não há nenhum dado (nem de uma busca anterior) pra
 *   mostrar — tela cheia de erro com "Tentar de novo".
 * - `offline-with-data`: falhou, mas ainda há dado de uma busca anterior em
 *   cache (React Query mantém o último `data` bom-sucedido durante um
 *   refetch que falha) — mostra a lista antiga com um aviso, nunca "vazio".
 * - `empty`: terminou de carregar sem erro e realmente não há item nenhum.
 */
export function resolveListLoadState(params: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  isEmpty: boolean;
}): ListLoadState {
  if (params.isError && !params.hasData) return 'error';
  if (params.isLoading) return 'loading';
  if (params.isError) return 'offline-with-data';
  if (params.isEmpty) return 'empty';
  return 'ready';
}
