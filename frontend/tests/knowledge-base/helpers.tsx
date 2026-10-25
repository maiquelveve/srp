import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type {
  KnowledgeDocumentItem,
  KnowledgeQueryItem,
} from '../../src/features/knowledge-base/types';
import { TooltipProvider } from '../../src/components/ui/tooltip';

export function renderWithProviders(ui: ReactElement): ReturnType<typeof render> {
  // Sem repetição automática: um erro simulado deve aparecer na hora, não depois de 3 tentativas.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

export function makeDocument(
  overrides: Partial<KnowledgeDocumentItem> = {},
): KnowledgeDocumentItem {
  return {
    id: 1,
    name: 'Regimento Interno',
    fileFormat: 'pdf',
    originalFileName: 'regimento.pdf',
    sizeBytes: 1000,
    status: 'READY',
    failureReason: null,
    chunkCount: 3,
    uploadedBy: { id: 1, name: 'Maria Souza' },
    createdAt: '2026-10-09T12:00:00.000Z',
    updatedAt: '2026-10-09T12:01:00.000Z',
    ...overrides,
  };
}

export function makeQuery(overrides: Partial<KnowledgeQueryItem> = {}): KnowledgeQueryItem {
  return {
    id: 1,
    question: 'Quais os passos da escolta hospitalar?',
    answer: 'Os passos são: 1) algemar, 2) conduzir.',
    outcome: 'ANSWERED',
    sources: [],
    askedBy: { id: 1, name: 'Maria Souza' },
    createdAt: '2026-10-10T14:03:11.000Z',
    ...overrides,
  };
}
