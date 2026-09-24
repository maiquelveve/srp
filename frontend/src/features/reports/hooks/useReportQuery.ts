import { useEffect } from 'react';
import { notify } from '@/lib/notify';

/** Erro de carga de um relatório vira `notify()` genérico, sem expor o erro cru da API. */
export function useNotifyOnError(isError: boolean, title: string): void {
  useEffect(() => {
    if (isError) {
      notify({ type: 'error', title, message: 'Não foi possível carregar os dados.' });
    }
  }, [isError, title]);
}
