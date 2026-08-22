const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Regra de validação do formulário de login — função pura, sem React
 * (research.md #32). Local à tela (não em `features/`) porque não existe um
 * domínio "auth" compartilhado por várias telas hoje.
 */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed.length === 0) return 'E-mail obrigatório';
  return EMAIL_REGEX.test(trimmed) ? null : 'E-mail inválido';
}

export function validatePassword(password: string): string | null {
  return password.length === 0 ? 'Senha obrigatória' : null;
}
