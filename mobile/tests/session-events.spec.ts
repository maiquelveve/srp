/**
 * mobile/src/services/session-events.ts (T128, research.md #55): garante um
 * único disparo por sessão encerrada, mesmo com várias chamadas simultâneas
 * (vários 401 ao mesmo tempo não podem gerar mais de um logout).
 */
import {
  notifySessionExpired,
  resetSessionExpired,
  subscribeSessionExpired,
} from '../src/services/session-events';

describe('Session events (T128)', () => {
  const unsubscribeFunctions: Array<() => void> = [];

  function subscribe(listener: () => void): void {
    unsubscribeFunctions.push(subscribeSessionExpired(listener));
  }

  beforeEach(() => {
    resetSessionExpired();
  });

  afterEach(() => {
    unsubscribeFunctions.splice(0).forEach((unsubscribe) => unsubscribe());
  });

  it('notifies every subscribed listener when the session expires', () => {
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    subscribe(firstListener);
    subscribe(secondListener);

    notifySessionExpired();

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
  });

  it('only fires once for several simultaneous notifications (no duplicate logout)', () => {
    const listener = jest.fn();
    subscribe(listener);

    notifySessionExpired();
    notifySessionExpired();
    notifySessionExpired();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('fires again after resetSessionExpired (new login started a new session)', () => {
    const listener = jest.fn();
    subscribe(listener);

    notifySessionExpired();
    resetSessionExpired();
    notifySessionExpired();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying a listener once it unsubscribes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSessionExpired(listener);
    unsubscribe();

    notifySessionExpired();

    expect(listener).not.toHaveBeenCalled();
  });
});
