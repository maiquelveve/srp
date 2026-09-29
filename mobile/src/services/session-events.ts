type Listener = () => void;

let listeners: Listener[] = [];

// Trava pra disparar o evento uma única vez por sessão encerrada — vários
// 401 simultâneos (ex.: várias telas buscando dado ao mesmo tempo) não devem
// gerar mais de um logout nem mais de uma navegação pro login (T128,
// research.md #55). `resetSessionExpired` reabre a trava pro próximo login.
let alreadyNotified = false;

/**
 * Evento de sessão encerrada pelo servidor: 401 mesmo depois de tentar
 * renovar o token (ex.: usuário desativado). O `api-client` dispara isso; o
 * `AuthContext` assina pra limpar o usuário logado e mandar de volta pro
 * login, sem import circular entre os dois módulos.
 */
export function notifySessionExpired(): void {
  if (alreadyNotified) return;
  alreadyNotified = true;
  listeners.forEach((listener) => listener());
}

export function subscribeSessionExpired(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((current) => current !== listener);
  };
}

/** Chamado após um login bem-sucedido, pra a próxima sessão poder disparar o evento de novo. */
export function resetSessionExpired(): void {
  alreadyNotified = false;
}
