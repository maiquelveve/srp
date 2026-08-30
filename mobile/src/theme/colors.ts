/**
 * Tema escuro (único, não opcional — research.md #16) + preto/dourado da
 * Polícia Penal RS. Mesmos valores HSL do bloco `.dark` de
 * frontend/src/index.css (research.md #27) — mudar aqui não propaga pro
 * frontend automaticamente, e vice-versa.
 */
export const colors = {
  background: 'hsl(240, 10%, 4%)',
  foreground: 'hsl(240, 5%, 96%)',

  card: 'hsl(240, 6%, 8%)',
  cardForeground: 'hsl(240, 5%, 96%)',

  primary: 'hsl(43, 96%, 56%)',
  primaryForeground: 'hsl(240, 10%, 4%)',

  secondary: 'hsl(240, 4%, 16%)',
  secondaryForeground: 'hsl(240, 5%, 96%)',

  muted: 'hsl(240, 4%, 16%)',
  mutedForeground: 'hsl(240, 5%, 65%)',

  accent: 'hsl(240, 4%, 16%)',
  accentForeground: 'hsl(43, 96%, 56%)',

  destructive: 'hsl(0, 84%, 60%)',
  destructiveForeground: 'hsl(0, 0%, 100%)',

  success: 'hsl(142, 72%, 29%)',
  successForeground: 'hsl(0, 0%, 100%)',

  warning: 'hsl(38, 92%, 50%)',
  warningForeground: 'hsl(240, 10%, 4%)',

  info: 'hsl(217, 91%, 60%)',
  infoForeground: 'hsl(0, 0%, 100%)',

  border: 'hsl(240, 4%, 18%)',
  input: 'hsl(240, 4%, 18%)',
  ring: 'hsl(43, 96%, 56%)',
} as const;
