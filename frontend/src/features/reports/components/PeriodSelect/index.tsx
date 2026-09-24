import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface PeriodSelectProps {
  id: string;
  label: string;
  value: number;
  options: number[];
  /** Sufixo do rótulo de cada opção, ex.: "dias" ou "horas". */
  unit: string;
  onChange: (value: number) => void;
}

/** Filtro numérico de período/limite compartilhado pelas abas de relatório. */
export default function PeriodSelect({
  id,
  label,
  value,
  options,
  unit,
  onChange,
}: PeriodSelectProps): JSX.Element {
  return (
    <div className="grid min-w-[160px] gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option} {unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
