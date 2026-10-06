import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpenIcon, SearchIcon, UploadIcon } from 'lucide-react';
import { documentsApi } from './api';
import DocumentCard from './components/DocumentCard';
import UploadDocumentDialog from './components/UploadDocumentDialog';
import type { DocumentTypeCode } from './types';
import PaginationBar from '@/features/reports/components/PaginationBar';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 12;
/** Espera a pessoa parar de digitar antes de buscar (FR-011, filtro instantâneo sem martelar a API). */
const SEARCH_DEBOUNCE_MS = 300;

export interface DocumentsPageProps {
  documentTypeCode: DocumentTypeCode;
}

const CATEGORY_DESCRIPTION: Record<DocumentTypeCode, string> = {
  FORM: 'Formulários prontos para preencher e usar no dia a dia.',
  TEMPLATE: 'Modelos de documentos para padronizar o preenchimento.',
  MANUAL: 'Manuais e guias de procedimento da unidade.',
};

/**
 * Biblioteca de Documentos (User Story 2, contracts/documents.md) — uma
 * instância por categoria fixa (roteada em `App.tsx`: Formulários/Modelos
 * de Documentos/Manuais). Qualquer perfil autenticado consulta e baixa
 * (FR-011); só WARDEN/SUPERVISOR enviam ou removem (FR-010/FR-012).
 */
export default function DocumentsPage({ documentTypeCode }: DocumentsPageProps): JSX.Element {
  const { user } = useAuth();
  const canManage = user?.role === 'WARDEN' || user?.role === 'SUPERVISOR';

  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Filtro "ao digitar" (pedido do usuário) com um respiro de 300ms — sem
  // isso, cada tecla dispararia uma chamada nova à API.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchDraft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchDraft]);

  useEffect(() => {
    setPage(0);
  }, [search, documentTypeCode]);

  const typesQuery = useQuery({ queryKey: ['document-types'], queryFn: documentsApi.listTypes });
  const category = typesQuery.data?.find((type) => type.code === documentTypeCode);

  const documentsQuery = useQuery({
    queryKey: ['documents', { documentTypeId: category?.id, search, page }],
    queryFn: () =>
      documentsApi.list({
        documentTypeId: category?.id,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    enabled: category !== undefined,
  });
  const documents = documentsQuery.data?.data ?? [];
  const total = documentsQuery.data?.total ?? 0;
  const isLoading = typesQuery.isLoading || documentsQuery.isLoading;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{category?.label ?? 'Biblioteca de Documentos'}</h1>
          <p className="text-sm text-muted-foreground">{CATEGORY_DESCRIPTION[documentTypeCode]}</p>
        </div>

        {canManage && category && (
          <UploadDocumentDialog documentTypeId={category.id}>
            <Button type="button">
              <UploadIcon />
              Enviar documento
            </Button>
          </UploadDocumentDialog>
        )}
      </div>

      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar documento pelo nome..."
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && documents.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          <FolderOpenIcon className="size-8" />
          {search
            ? 'Nenhum documento encontrado para essa busca.'
            : 'Nenhum documento nesta categoria ainda.'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {documents.map((document) => (
          <DocumentCard key={document.id} document={document} canManage={canManage} />
        ))}
      </div>

      {!isLoading && total > 0 && (
        <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      )}
    </div>
  );
}
