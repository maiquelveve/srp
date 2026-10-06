import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { usersApi } from './api';
import UserCard from './components/UserCard';
import UserDialog from './components/UserDialog';
import { ROLE_OPTIONS } from './labels';
import type { PasswordActionResult } from './types';
import PaginationBar from '@/features/reports/components/PaginationBar';
import { structureApi } from '@/features/structure/api';
import type { RoleName } from '@/features/structure/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 12;
const ALL = 'all';

interface Filters {
  unitId: string;
  role: string;
  active: string;
  search: string;
}

const EMPTY_FILTERS: Filters = { unitId: ALL, role: ALL, active: ALL, search: '' };

/**
 * Administração de Usuários (User Story 1, FR-001…FR-008a) — só WARDEN.
 * Cadastro, edição (incluindo perfil), ativar/desativar, trocar/adicionar
 * lotação e resetar senha, em cards (docs/style-guide.md, FR-021). Nunca
 * lista o próprio requisitante (o backend já exclui — edição da própria
 * conta será resolvida por uma tela de perfil, fora deste escopo). O aviso
 * "e-mail não entregue" (FR-002a/FR-007a) fica dentro do card do usuário
 * afetado, com um botão para reenviar — `pendingEmailWarnings` guarda esse
 * estado localmente porque `GET /users` não devolve `emailDelivered` (só as
 * respostas de criar/resetar/reenviar, que são o que preenche esse mapa).
 */
export default function UsersPage(): JSX.Element {
  const { user: currentUser } = useAuth();
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [pendingEmailWarnings, setPendingEmailWarnings] = useState<Record<number, boolean>>({});

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const units = unitsQuery.data?.data ?? [];

  const usersQuery = useQuery({
    queryKey: ['users', applied, page],
    queryFn: () =>
      usersApi.list({
        unitId: applied.unitId === ALL ? undefined : Number(applied.unitId),
        role: applied.role === ALL ? undefined : (applied.role as RoleName),
        active: applied.active === ALL ? undefined : applied.active === 'true',
        search: applied.search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });
  const users = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.total ?? 0;

  if (currentUser?.role !== 'WARDEN') {
    return <Navigate to="/inicio" replace />;
  }

  function handleSearch(): void {
    setApplied(draft);
    setPage(0);
  }

  function handlePasswordActionResult(userId: number, result: PasswordActionResult): void {
    setPendingEmailWarnings((current) => ({ ...current, [userId]: !result.emailDelivered }));
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-[200px] flex-1 gap-1.5">
          <Label htmlFor="users-search">Buscar</Label>
          <Input
            id="users-search"
            placeholder="Nome, e-mail ou matrícula"
            value={draft.search}
            onChange={(e) => setDraft({ ...draft, search: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <div className="grid min-w-[180px] gap-1.5">
          <Label>Unidade</Label>
          <Select value={draft.unitId} onValueChange={(value) => setDraft({ ...draft, unitId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as unidades</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={String(unit.id)}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[160px] gap-1.5">
          <Label>Perfil</Label>
          <Select value={draft.role} onValueChange={(value) => setDraft({ ...draft, role: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os perfis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os perfis</SelectItem>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-[140px] gap-1.5">
          <Label>Status</Label>
          <Select value={draft.active} onValueChange={(value) => setDraft({ ...draft, active: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value="true">Ativos</SelectItem>
              <SelectItem value="false">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          {/* Pesquisar é uma ação do filtro (secundária/neutra), nunca a mesma
              variante de "Cadastrar usuário" (a ação primária da tela). `secondary`
              (fundo sólido cinza) em vez de `outline` aqui de propósito: `outline`
              usa exatamente as mesmas classes de borda/fundo do Input/Select
              ao lado (`border-input bg-background`) e emenda visualmente com o
              filtro, parecendo mais um campo do que um botão. */}
          <Button variant="secondary" onClick={handleSearch}>
            <SearchIcon />
            Pesquisar
          </Button>
        </div>

        <div className="ml-auto">
          <UserDialog
            units={units}
            onCreated={(created) =>
              handlePasswordActionResult(created.id, {
                message: '',
                emailDelivered: created.emailDelivered ?? true,
              })
            }
          >
            <Button>
              <PlusIcon />
              Cadastrar usuário
            </Button>
          </UserDialog>
        </div>
      </div>

      {usersQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando usuários...</p>}

      {!usersQuery.isLoading && users.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
          Nenhum usuário encontrado para os filtros selecionados.
        </div>
      )}

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            units={units}
            hasPendingEmailWarning={pendingEmailWarnings[user.id] === true}
            onPasswordActionResult={(result) => handlePasswordActionResult(user.id, result)}
          />
        ))}
      </div>

      {!usersQuery.isLoading && total > 0 && (
        <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      )}
    </div>
  );
}
