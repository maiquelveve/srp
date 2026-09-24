import { useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { staffApi } from '../api';
import { todayIsoDate } from '../date';
import { useUnitPosts } from '../hooks/useUnitPosts';
import { SHIFT_OPTIONS } from '../labels';
import type { Shift } from '../types';
import { notify } from '@/lib/notify';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function cellKey(postId: number, shift: Shift): string {
  return `${postId}|${shift}`;
}

interface MinimumChange {
  postId: number;
  shift: Shift;
  minimumHeadcount: number;
}

/**
 * Configuração do efetivo mínimo por unidade (FR-024, research.md #12): uma
 * matriz posto x turno com o mínimo atual de cada célula, editável no
 * lugar. Os valores atuais vêm do próprio relatório
 * `GET /schedules/minimum-staffing` (uma chamada por turno) e só as células
 * alteradas são enviadas ao salvar. Só `WARDEN` (a API responde 403 aos
 * demais); os outros perfis são redirecionados para a tela de Efetivo.
 *
 * Não existe remoção de mínimo na API (`minimumHeadcount >= 1`), então uma
 * célula já configurada não pode ser esvaziada: apagar o campo volta ao
 * valor salvo.
 */
export default function MinimumStaffingConfigPage(): JSX.Element {
  const { user } = useAuth();
  const { unitId, setUnitId, units, posts, isLoadingPosts } = useUnitPosts();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();
  const referenceDate = todayIsoDate();

  const reportQueries = useQueries({
    queries: SHIFT_OPTIONS.map((option) => ({
      queryKey: ['minimum-staffing', unitId, referenceDate, option.value],
      queryFn: () =>
        staffApi.minimumStaffing({
          unitId: unitId as number,
          date: referenceDate,
          shift: option.value,
        }),
      enabled: unitId !== null,
    })),
  });
  const isLoading = isLoadingPosts || reportQueries.some((query) => query.isLoading);

  function savedMinimum(postId: number, shift: Shift): number | null {
    const shiftIndex = SHIFT_OPTIONS.findIndex((option) => option.value === shift);
    const entry = reportQueries[shiftIndex]?.data?.posts.find((item) => item.postId === postId);
    return entry && entry.minimum > 0 ? entry.minimum : null;
  }

  function changedCells(): MinimumChange[] {
    const changes: MinimumChange[] = [];
    for (const post of posts) {
      for (const { value: shift } of SHIFT_OPTIONS) {
        const draft = drafts[cellKey(post.id, shift)];
        if (draft === undefined || draft === '') continue;
        const minimumHeadcount = Number(draft);
        if (
          Number.isInteger(minimumHeadcount) &&
          minimumHeadcount >= 1 &&
          minimumHeadcount !== savedMinimum(post.id, shift)
        ) {
          changes.push({ postId: post.id, shift, minimumHeadcount });
        }
      }
    }
    return changes;
  }

  const changes = changedCells();

  const mutation = useMutation({
    mutationFn: () =>
      Promise.all(changes.map((change) => staffApi.updateMinimumStaffingConfig(change))),
    onSuccess: () => {
      notify({
        message:
          changes.length === 1
            ? 'Efetivo mínimo atualizado'
            : `${changes.length} valores de efetivo mínimo atualizados`,
        type: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['minimum-staffing'] });
      setDrafts({});
    },
    onError: () =>
      notify({ title: 'Não foi possível salvar', message: 'Verifique os valores', type: 'error' }),
  });

  if (user?.role !== 'WARDEN') {
    return <Navigate to="/efetivo" replace />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-[200px] flex-1 gap-1.5">
          <Label>Unidade</Label>
          <Select
            value={unitId ? String(unitId) : ''}
            onValueChange={(value) => {
              setUnitId(Number(value));
              setDrafts({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={String(unit.id)}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link to="/efetivo">
              <ArrowLeftIcon />
              Voltar para Efetivo
            </Link>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Defina quantos policiais cada posto precisa ter em cada turno. Quando o efetivo escalado
        fica abaixo desse número, a tela de Efetivo sinaliza o posto. Deixe em branco os turnos sem
        mínimo.
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posto</TableHead>
                {SHIFT_OPTIONS.map((option) => (
                  <TableHead key={option.value} className="text-center">
                    {option.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                [0, 1, 2].map((rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell colSpan={SHIFT_OPTIONS.length + 1}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading &&
                posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.name}</TableCell>
                    {SHIFT_OPTIONS.map((option) => {
                      const key = cellKey(post.id, option.value);
                      const saved = savedMinimum(post.id, option.value);
                      const draft = drafts[key];
                      return (
                        <TableCell key={option.value}>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            aria-label={`${post.name}, turno ${option.label.toLowerCase()}`}
                            placeholder="-"
                            value={draft ?? (saved === null ? '' : String(saved))}
                            onChange={(event) =>
                              setDrafts((current) => ({ ...current, [key]: event.target.value }))
                            }
                            onBlur={() => {
                              if (draft === '' && saved !== null) {
                                setDrafts((current) => {
                                  const rest = { ...current };
                                  delete rest[key];
                                  return rest;
                                });
                              }
                            }}
                            className="mx-auto w-24 text-center"
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              {!isLoading && posts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={SHIFT_OPTIONS.length + 1}
                    className="text-center text-muted-foreground"
                  >
                    Esta unidade não tem postos ativos. Cadastre os postos em Postos de serviço para
                    definir o efetivo mínimo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-between gap-4 border-t border-border p-4">
          <span className="text-sm text-muted-foreground">
            {changes.length === 0
              ? 'Nenhuma alteração pendente.'
              : `${changes.length} ${changes.length === 1 ? 'alteração pendente' : 'alterações pendentes'}.`}
          </span>
          <Button
            onClick={() => mutation.mutate()}
            disabled={changes.length === 0 || mutation.isPending}
          >
            {mutation.isPending
              ? 'Salvando...'
              : changes.length > 0
                ? `Salvar alterações (${changes.length})`
                : 'Salvar alterações'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
