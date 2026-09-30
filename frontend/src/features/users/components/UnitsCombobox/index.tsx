import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import type { Unit } from '@/features/structure/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface UnitsComboboxProps {
  /** Unidades que podem ser escolhidas — quem chama já filtra (ex.: excluir as já vinculadas). */
  candidateUnits: Unit[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  /** Máximo de seleções simultâneas (regra de negócio: no máximo 3 lotações por usuário). */
  max?: number;
  placeholder?: string;
}

const DEFAULT_MAX = 3;

/**
 * Combobox de múltipla seleção com busca (Popover + Command/cmdk,
 * docs/style-guide.md — mesmo padrão de "Preso de destino" em
 * CellTransferDialog, adaptado pra múltipla escolha): a lista de unidades
 * pode crescer bastante em produção, então digitar pra filtrar por nome ou
 * sigla é melhor do que rolar um `Select` fechado. `shouldFilter={false}` +
 * filtro por substring nosso, não o fuzzy-match padrão do cmdk (mesmo motivo
 * já documentado em CellTransferDialog).
 */
export default function UnitsCombobox({
  candidateUnits,
  selectedIds,
  onChange,
  max = DEFAULT_MAX,
  placeholder = 'Buscar lotação por nome ou sigla...',
}: UnitsComboboxProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedUnits = candidateUnits.filter((unit) => selectedIds.includes(unit.id));
  const atMax = selectedIds.length >= max;

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUnits =
    normalizedSearch === ''
      ? candidateUnits
      : candidateUnits.filter(
          (unit) =>
            unit.name.toLowerCase().includes(normalizedSearch) ||
            (unit.code ?? '').toLowerCase().includes(normalizedSearch),
        );

  function toggle(unitId: number): void {
    if (selectedIds.includes(unitId)) {
      onChange(selectedIds.filter((id) => id !== unitId));
      return;
    }
    if (atMax) return;
    onChange([...selectedIds, unitId]);
  }

  return (
    <div className="space-y-2">
      {selectedUnits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUnits.map((unit) => {
            const chip = (
              <Badge variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">
                {unit.code ?? unit.name}
                <button
                  type="button"
                  onClick={() => toggle(unit.id)}
                  className="rounded-full p-0.5 hover:bg-background/60"
                >
                  <X className="size-3" />
                  <span className="sr-only">Remover {unit.name}</span>
                </button>
              </Badge>
            );
            if (!unit.code) return <div key={unit.id}>{chip}</div>;
            return (
              <Tooltip key={unit.id}>
                {/* `asChild` precisa de um filho com `React.forwardRef` pra
                    ancorar a posição do tooltip — `Badge` não tem, então o
                    gatilho vai num `<span>` (elemento nativo), não direto
                    nela (mesmo ajuste de UserCard). */}
                <TooltipTrigger asChild>
                  <span>{chip}</span>
                </TooltipTrigger>
                <TooltipContent>{unit.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-muted-foreground"
          >
            <span className="truncate">{placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput placeholder="Nome ou sigla..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
              <CommandGroup>
                {filteredUnits.map((unit) => {
                  const isSelected = selectedIds.includes(unit.id);
                  const disabled = !isSelected && atMax;
                  return (
                    <CommandItem
                      key={unit.id}
                      value={String(unit.id)}
                      disabled={disabled}
                      onSelect={() => toggle(unit.id)}
                    >
                      <Check className={cn('size-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex flex-col">
                        <span>{unit.name}</span>
                        {unit.code && <span className="text-xs text-muted-foreground">{unit.code}</span>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          {atMax && (
            <p className="border-t border-border px-3 py-2 text-xs text-warning">
              Máximo de {max} lotações selecionadas.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
