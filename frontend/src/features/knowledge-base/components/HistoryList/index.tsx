import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { HistoryIcon, SearchIcon, UserIcon } from 'lucide-react';
import { knowledgeApi } from '../../api';
import type { KnowledgeQueryItem, KnowledgeQueryOutcome } from '../../types';
import AnswerCard from '../AnswerCard';
import { formatDateTime } from '../../../reports/format';
import { REPORT_PAGE_SIZE, usePagedState } from '../../../reports/hooks/usePagedState';
import { useNotifyOnError } from '../../../reports/hooks/useReportQuery';
import PaginationBar from '../../../reports/components/PaginationBar';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

/** Só os resultados que fogem do normal ganham selo; uma resposta comum não precisa de destaque. */
const OUTCOME_BADGE: Partial<
  Record<KnowledgeQueryOutcome, { label: string; variant: BadgeProps['variant'] }>
> = {
  NO_ANSWER: { label: 'Sem resposta', variant: 'secondary' },
  EXCERPTS_ONLY: { label: 'Só trechos', variant: 'warning' },
};

function HistoryEntry({ item }: { item: KnowledgeQueryItem }): JSX.Element {
  const badge = OUTCOME_BADGE[item.outcome];
  return (
    <article className="space-y-4 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <UserIcon className="size-4" />
          <span className="font-medium text-foreground">{item.askedBy.name}</span>
          <span aria-hidden>·</span>
          <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
        </span>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </header>

      <p className="whitespace-pre-wrap text-sm font-semibold">{item.question}</p>

      <AnswerCard item={item} />
    </article>
  );
}

/**
 * Aba "Histórico": todas as perguntas e respostas, de todos os usuários, da mais recente
 * para a mais antiga. Somente leitura: o histórico é imutável (FR-024), então aqui não
 * existe nenhuma ação de editar ou excluir.
 */
export default function HistoryList(): JSX.Element {
  // `draft` é o que está digitado; `search` só muda ao clicar em Pesquisar.
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = usePagedState(search);

  const historyQuery = useQuery({
    queryKey: ['knowledge-queries', search, page],
    queryFn: () =>
      knowledgeApi.listQueries({
        search: search.trim() || undefined,
        limit: REPORT_PAGE_SIZE,
        offset: page * REPORT_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  useNotifyOnError(historyQuery.isError, 'Histórico da base de conhecimento');

  function handleSearch(event: FormEvent): void {
    event.preventDefault();
    setSearch(draft);
  }

  const items = historyQuery.data?.data ?? [];
  const emptyMessage =
    search.trim() !== ''
      ? 'Nenhuma pergunta encontrada com esse texto.'
      : 'Nenhuma pergunta feita ainda. As consultas feitas no Chat aparecem aqui.';

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4"
      >
        <div className="grid min-w-[220px] flex-1 gap-1.5">
          <Label htmlFor="knowledge-history-search">Texto da pergunta</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="knowledge-history-search"
              className="pl-9"
              placeholder="Parte da pergunta"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
        </div>
        <Button type="submit" className="ml-auto gap-1.5">
          <SearchIcon className="size-4" />
          Pesquisar
        </Button>
      </form>

      <div className="space-y-3">
        {historyQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-accent text-primary">
              <HistoryIcon className="size-6" />
            </div>
            <p className="max-w-md text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <HistoryEntry key={item.id} item={item} />
            ))}
          </div>
        )}
        <PaginationBar
          page={page}
          pageSize={REPORT_PAGE_SIZE}
          total={historyQuery.data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
