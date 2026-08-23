/** Saudação por horário do dia — puro, sem React (research.md #32/#33). */
export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Boa noite';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Primeiro nome, pra uma saudação mais compacta no header. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
