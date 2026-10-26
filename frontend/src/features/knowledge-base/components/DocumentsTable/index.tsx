import { forwardRef, useEffect, useRef, useState, type ComponentProps, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon, PencilIcon, RefreshCwIcon, SearchIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { knowledgeApi } from '../../api';
import type { KnowledgeDocumentItem, KnowledgeDocumentStatus } from '../../types';
import DeleteDocumentDialog from '../DeleteDocumentDialog';
import { describeFailure } from '../../failure-reason';
import DocumentActionButton from '../DocumentActionButton';
import EditDocumentDialog from '../EditDocumentDialog';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

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
 * Botão de ícone com tooltip, no padrão da coluna "Ações". Repassa a ref e as props porque
 * os diálogos o usam como gatilho (`asChild`), e o Radix precisa alcançar o botão de verdade.
 */
const RowIconButton = forwardRef<
  HTMLButtonElement,
  { label: string } & ComponentProps<typeof Button>
>(({ label, className, ...buttonProps }, ref) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        // Neutro em repouso, como o "Visualizar"; a cor só aparece no hover.
        className={cn('size-7 text-muted-foreground transition-colors', className)}
        {...buttonProps}
      />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
));
RowIconButton.displayName = 'RowIconButton';

/** Reprocessar só faz sentido para quem falhou ou foi indexado com outro modelo de IA. */
function ReprocessButton({ document }: { document: KnowledgeDocumentItem }): JSX.Element {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => knowledgeApi.reprocessDocument(document.id),
    onSuccess: () => {
      notify({ message: `${document.name} voltou para a fila de processamento.`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
    },
    onError: () => {
      notify({
        title: 'Não foi possível reprocessar',
        message: 'Tente novamente',
        type: 'error',
      });
    },
  });
  return (
    <RowIconButton
      label="Reprocessar documento"
      className="hover:bg-info/10 hover:text-info"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <RefreshCwIcon className={`size-4 ${mutation.isPending ? 'animate-spin' : ''}`} />
    </RowIconButton>
  );
}

/** Ações de uma linha. Em processamento só aparece o indicador, sem editar nem excluir. */
function DocumentRowActions({ document }: { document: KnowledgeDocumentItem }): JSX.Element {
  const canReprocess = document.status === 'FAILED' || document.status === 'NEEDS_REPROCESS';

  if (IN_PROGRESS_STATUSES.includes(document.status)) {
    const message =
      document.status === 'UPDATING'
        ? 'Atualizando. A versão atual continua valendo até a troca terminar.'
        : 'Processando. Aguarde terminar para editar ou excluir.';
    return (
      <div className="flex items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex size-7 items-center justify-center"
              role="img"
              aria-label={message}
            >
              <LoaderCircleIcon className="size-4 animate-spin text-info" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{message}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <DocumentActionButton document={document} />
      {canReprocess && <ReprocessButton document={document} />}
      <EditDocumentDialog document={document}>
        <RowIconButton label="Editar documento" className="hover:bg-info/10 hover:text-info">
          <PencilIcon className="size-4" />
        </RowIconButton>
      </EditDocumentDialog>
      <DeleteDocumentDialog document={document}>
        <RowIconButton
          label="Excluir documento"
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2Icon className="size-4" />
        </RowIconButton>
      </DeleteDocumentDialog>
    </div>
  );
}

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

  // A atualização roda em segundo plano e uma falha costuma ser tão rápida que a lista nunca
  // chega a mostrar "Atualizando": o documento já volta a READY com o motivo. Por isso o erro
  // vem de "READY com motivo de falha e `updatedAt` novo", não da passagem por UPDATING.
  // O sucesso, ao contrário, só é avisado quando se viu o UPDATING terminar sem falha.
  const previousDocuments = useRef(
    new Map<number, { updatedAt: string; status: KnowledgeDocumentStatus }>(),
  );
  useEffect(() => {
    const documents = documentsQuery.data?.data;
    if (!documents) {
      return;
    }
    for (const document of documents) {
      const previous = previousDocuments.current.get(document.id);
      if (!previous || previous.updatedAt === document.updatedAt || document.status !== 'READY') {
        continue;
      }
      if (document.failureReason) {
        notify({
          title: `Não foi possível atualizar ${document.name}`,
          message: `A versão anterior foi mantida. ${describeFailure(document.failureReason)}`,
          type: 'error',
        });
      } else if (previous.status === 'UPDATING') {
        notify({ message: `${document.name} atualizado.`, type: 'success' });
      }
    }
    previousDocuments.current = new Map(
      documents.map((d) => [d.id, { updatedAt: d.updatedAt, status: d.status }]),
    );
  }, [documentsQuery.data]);

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
    <DocumentRowActions key="action" document={document} />,
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
