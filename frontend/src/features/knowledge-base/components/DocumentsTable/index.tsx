import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SearchIcon, UploadIcon } from 'lucide-react';
import { knowledgeApi } from '../../api';
import type { KnowledgeDocumentStatus } from '../../types';
import DocumentActionButton from '../DocumentActionButton';
import UploadDocumentDialog from '../UploadDocumentDialog';
import { formatDateTime } from '../../../reports/format';
import { REPORT_PAGE_SIZE, usePagedState } from '../../../reports/hooks/usePagedState';
import { useNotifyOnError } from '../../../reports/hooks/useReportQuery';
import PaginationBar from '../../../reports/components/PaginationBar';
import ReportTable from '../../../reports/components/ReportTable';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Intervalo da atualização automática enquanto algum documento está sendo processado. */
const POLLING_INTERVAL_MS = 3000;

/** Estados que ainda vão mudar sozinhos: enquanto houver um na página, a lista se atualiza. */
const IN_PROGRESS_STATUSES: KnowledgeDocumentStatus[] = ['PROCESSING', 'UPDATING'];

/** Texto e cor de cada estado. As cores seguem o mapeamento do style guide (seção 1). */
const STATUS_BADGE: Record<
  KnowledgeDocumentStatus,
  { label: string; variant: BadgeProps['variant'] }
> = {
  PROCESSING: { label: 'Processando', variant: 'info' },
  READY: { label: 'Disponível para consulta', variant: 'success' },
  UPDATING: { label: 'Atualizando', variant: 'info' },
  FAILED: { label: 'Falhou', variant: 'destructive' },
  NEEDS_REPROCESS: { label: 'Precisa reprocessar', variant: 'warning' },
};

/**
 * Aba "Documentos": lista paginada com busca por nome e envio de novos
 * documentos. Enquanto houver documento em PROCESSING/UPDATING na página, a
 * lista é refeita a cada 3 s; quando todos terminam, o polling para sozinho.
 */
export default function DocumentsTable(): JSX.Element {
  // `draft` é o que está digitado; `search` só muda ao clicar em Pesquisar.
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = usePagedState(search);

  const documentsQuery = useQuery({
    queryKey: ['knowledge-documents', search, page],
    queryFn: () =>
      knowledgeApi.listDocuments({
        search: search.trim() || undefined,
        limit: REPORT_PAGE_SIZE,
        offset: page * REPORT_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    // Chamada após cada resposta: devolve o intervalo em ms para continuar,
    // ou false para parar. Sem documento em andamento, não há requisição extra.
    refetchInterval: (query) => {
      const documents = query.state.data?.data ?? [];
      const hasWorkInProgress = documents.some((document) =>
        IN_PROGRESS_STATUSES.includes(document.status),
      );
      return hasWorkInProgress ? POLLING_INTERVAL_MS : false;
    },
  });
  useNotifyOnError(documentsQuery.isError, 'Documentos da base de conhecimento');

  function handleSearch(event: FormEvent): void {
    event.preventDefault();
    setSearch(draft);
  }

  const emptyMessage =
    search.trim() !== ''
      ? 'Nenhum documento encontrado com esse nome.'
      : 'Nenhum documento enviado ainda. Use "Enviar documento" para começar.';

  const rows = (documentsQuery.data?.data ?? []).map((document) => [
    <span key="name" className="block min-w-[180px] font-medium">
      {document.name}
    </span>,
    <span key="format" className="uppercase">
      {document.fileFormat}
    </span>,
    <span key="date" className="whitespace-nowrap">
      {formatDateTime(document.createdAt)}
    </span>,
    document.uploadedBy.name,
    <Badge key="status" variant={STATUS_BADGE[document.status].variant} className="whitespace-nowrap">
      {STATUS_BADGE[document.status].label}
    </Badge>,
    <div key="action" className="flex justify-center">
      <DocumentActionButton document={document} />
    </div>,
  ]);

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4"
      >
        <div className="grid min-w-[220px] flex-1 gap-1.5">
          <Label htmlFor="knowledge-documents-search">Nome do documento</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="knowledge-documents-search"
              className="pl-9"
              placeholder="Parte do nome"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button type="submit" className="gap-1.5">
            <SearchIcon className="size-4" />
            Pesquisar
          </Button>
          <UploadDocumentDialog>
            {/* Já nasce com o visual do hover do outline (bg-accent); ao passar o mouse, borda e texto ganham o dourado. */}
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 bg-accent text-accent-foreground hover:border-primary hover:bg-accent hover:text-primary"
            >
              <UploadIcon className="size-4" />
              Enviar documento
            </Button>
          </UploadDocumentDialog>
        </div>
      </form>

      <div className="space-y-3">
        <ReportTable
          columns={['Nome', 'Tipo', 'Enviado em', 'Enviado por', 'Estado', 'Ações']}
          rows={rows}
          isLoading={documentsQuery.isLoading}
          emptyMessage={emptyMessage}
        />
        <PaginationBar
          page={page}
          pageSize={REPORT_PAGE_SIZE}
          total={documentsQuery.data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
