export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastState {
  id: number;
  variant: ToastVariant;
  message: string;
}

type Listener = (toast: ToastState | null) => void;

let current: ToastState | null = null;
let listeners: Listener[] = [];
let nextId = 1;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  listeners.forEach((listener) => listener(current));
}

function show(variant: ToastVariant, message: string): void {
  if (hideTimer) clearTimeout(hideTimer);
  current = { id: nextId++, variant, message };
  emit();
  hideTimer = setTimeout(() => {
    current = null;
    emit();
  }, 3000);
}

/**
 * API imperativa equivalente ao `notify()` do frontend (research.md #19) —
 * sem `sonner` (não existe pra React Native); `<Toaster />` é o motor visual.
 */
export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  warning: (message: string) => show('warning', message),
  info: (message: string) => show('info', message),
};

export function subscribeToast(listener: Listener): () => void {
  listeners.push(listener);
  listener(current);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
