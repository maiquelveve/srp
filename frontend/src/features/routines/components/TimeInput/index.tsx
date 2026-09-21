import { useState, type KeyboardEvent } from 'react';
import { isValidTime } from '../../time';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const EMPTY_MASK = '__:__';
/** Índices de `EMPTY_MASK` que guardam dígito (2 é o ':' fixo). */
const DIGIT_POSITIONS = [0, 1, 3, 4];

function normalizeDisplay(value: string): string {
  return /^[0-9_]{2}:[0-9_]{2}$/.test(value) ? value : EMPTY_MASK;
}

/**
 * Campo de hora com máscara fixa (HH:mm) sempre visível — digitar preenche
 * o próximo dígito em branco, Backspace/Delete limpa o último preenchido.
 * Substitui `<input type="time">` porque o seletor nativo só oferece
 * horários a partir da hora atual em diante (comportamento inconsistente
 * entre navegadores, reportado pelo usuário), fora do controle da
 * aplicação. Estilo de erro segue o mesmo padrão de `LoginPage` (texto
 * `text-sm text-destructive` abaixo do campo, sem alterar a borda).
 */
export default function TimeInput({
  id,
  value,
  onChange,
  className,
  /** Erro externo (ex.: horário repetido nas outras linhas) — só exibido quando o valor já está completo/válido. */
  error,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  error?: string;
}): JSX.Element {
  const [touched, setTouched] = useState(false);
  const display = normalizeDisplay(value);
  const formatInvalid = touched && value.length > 0 && !isValidTime(value);
  const message = formatInvalid ? 'Hora inválida.' : isValidTime(value) ? error : undefined;
  const invalid = formatInvalid || Boolean(message);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    // Navegação/atalhos do navegador continuam funcionando normalmente;
    // qualquer outra tecla só altera o valor pelas regras da máscara abaixo,
    // nunca por digitação livre.
    if (e.key === 'Tab' || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }
    e.preventDefault();

    const current = display.split('');

    if (/^[0-9]$/.test(e.key)) {
      const slot = DIGIT_POSITIONS.find((pos) => current[pos] === '_');
      if (slot === undefined) return;
      current[slot] = e.key;
      onChange(current.join(''));
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const slot = [...DIGIT_POSITIONS].reverse().find((pos) => current[pos] !== '_');
      if (slot === undefined) return;
      current[slot] = '_';
      onChange(current.join(''));
    }
  }

  return (
    <div className={cn('grid gap-1', className)}>
      <Input
        id={id}
        inputMode="numeric"
        value={display}
        onKeyDown={handleKeyDown}
        onChange={() => {
          /* controlado só via onKeyDown (máscara) — evita colar texto livre. */
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid}
        className="w-full"
      />
      {/* break-words: sem isso, uma mensagem de erro força o container a
          crescer além da largura do campo, empurrando os elementos vizinhos
          da linha (feedback do usuário). */}
      {message && <p className="text-sm text-destructive break-words">{message}</p>}
    </div>
  );
}
