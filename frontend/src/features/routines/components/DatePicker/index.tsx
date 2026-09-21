import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ptBR as ptBRDayPicker } from 'react-day-picker/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Substitui `<input type="date">` nativo por um calendário próprio
 * (`Popover` + `Calendar`/`react-day-picker`, `npx shadcn@latest add
 * calendar`) — o popup nativo do navegador não aceita ser tingido com as
 * cores do sistema (fundo escuro funcionou via `color-scheme`, mas o dia
 * selecionado/botões continuaram azul do navegador mesmo com `accent-color`
 * correto no elemento, confirmado em múltiplos navegadores). Sendo DOM/CSS
 * normal, este calendário usa `bg-primary`/`text-primary-foreground` do
 * próprio tema (mesmas classes de qualquer outro componente shadcn da
 * aplicação) e nunca digita — só seleciona (research.md #44).
 */
export default function DatePicker({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn('justify-start gap-2 font-normal', className)}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {selected ? format(selected, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBRDayPicker}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(toIsoDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
