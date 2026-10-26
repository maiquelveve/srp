import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DocumentsTable from '../../src/features/knowledge-base/components/DocumentsTable';
import { knowledgeApi } from '../../src/features/knowledge-base/api';
import { notify } from '../../src/lib/notify';
import { makeDocument, renderWithProviders } from './helpers';

vi.mock('../../src/features/knowledge-base/api', () => ({
  knowledgeApi: { listDocuments: vi.fn(), reprocessDocument: vi.fn() },
}));
vi.mock('../../src/lib/notify', () => ({ notify: vi.fn() }));

function listReturns(...documents: ReturnType<typeof makeDocument>[]): void {
  vi.mocked(knowledgeApi.listDocuments).mockResolvedValue({
    data: documents,
    total: documents.length,
  });
}

/** A linha (`tr`) do documento com esse nome. */
async function rowOf(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name);
  return cell.closest('tr') as HTMLElement;
}

describe('DocumentsTable', () => {
  describe('states and row actions', () => {
    beforeEach(() => {
      listReturns(
        makeDocument({ id: 1, name: 'Pronto', status: 'READY' }),
        makeDocument({ id: 2, name: 'Em processamento', status: 'PROCESSING' }),
        makeDocument({ id: 3, name: 'Em atualizacao', status: 'UPDATING' }),
        makeDocument({ id: 4, name: 'Com falha', status: 'FAILED', failureReason: 'UNKNOWN' }),
        makeDocument({ id: 5, name: 'Outro modelo', status: 'NEEDS_REPROCESS' }),
      );
    });

    it('shows each state with its label', async () => {
      renderWithProviders(<DocumentsTable />);

      expect(
        await within(await rowOf('Pronto')).findByText('Disponível para consulta'),
      ).toBeVisible();
      expect(within(await rowOf('Em processamento')).getByText('Processando')).toBeVisible();
      expect(within(await rowOf('Em atualizacao')).getByText('Atualizando')).toBeVisible();
      expect(within(await rowOf('Com falha')).getByText('Falhou')).toBeVisible();
      expect(within(await rowOf('Outro modelo')).getByText('Precisa reprocessar')).toBeVisible();
    });

    it('offers view, edit and delete on a ready document, and no reprocess', async () => {
      renderWithProviders(<DocumentsTable />);

      const row = within(await rowOf('Pronto'));
      expect(row.getByRole('button', { name: 'Visualizar documento' })).toBeInTheDocument();
      expect(row.getByRole('button', { name: 'Editar documento' })).toBeInTheDocument();
      expect(row.getByRole('button', { name: 'Excluir documento' })).toBeInTheDocument();
      expect(row.queryByRole('button', { name: 'Reprocessar documento' })).not.toBeInTheDocument();
    });

    it.each(['Em processamento', 'Em atualizacao'])(
      'shows only the progress indicator, with no edit or delete, while "%s"',
      async (name) => {
        renderWithProviders(<DocumentsTable />);

        const row = within(await rowOf(name));
        expect(row.getByRole('img')).toBeInTheDocument();
        expect(row.queryByRole('button')).not.toBeInTheDocument();
      },
    );

    it.each(['Com falha', 'Outro modelo'])('offers reprocess on "%s"', async (name) => {
      renderWithProviders(<DocumentsTable />);

      const row = within(await rowOf(name));
      expect(row.getByRole('button', { name: 'Reprocessar documento' })).toBeInTheDocument();
      expect(row.getByRole('button', { name: 'Editar documento' })).toBeInTheDocument();
    });
  });

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('refreshes every 3 seconds while a document is processing and stops once it is done', async () => {
      vi.mocked(knowledgeApi.listDocuments)
        .mockResolvedValueOnce({
          data: [makeDocument({ status: 'PROCESSING' })],
          total: 1,
        })
        .mockResolvedValue({ data: [makeDocument({ status: 'READY' })], total: 1 });
      renderWithProviders(<DocumentsTable />);

      expect(await screen.findByText('Processando')).toBeVisible();
      expect(knowledgeApi.listDocuments).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(await screen.findByText('Disponível para consulta')).toBeVisible();
      expect(knowledgeApi.listDocuments).toHaveBeenCalledTimes(2);

      // Tudo pronto: nenhuma requisição extra, por mais que o tempo passe.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
      });
      expect(knowledgeApi.listDocuments).toHaveBeenCalledTimes(2);
    });

    it('does not poll when nothing is in progress', async () => {
      listReturns(makeDocument({ status: 'READY' }));
      renderWithProviders(<DocumentsTable />);

      await screen.findByText('Disponível para consulta');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });

      expect(knowledgeApi.listDocuments).toHaveBeenCalledTimes(1);
    });

    it('notifies the error, and not a success, when an update ends in failure', async () => {
      vi.mocked(knowledgeApi.listDocuments)
        .mockResolvedValueOnce({
          data: [makeDocument({ status: 'UPDATING', updatedAt: '2026-10-09T12:01:00.000Z' })],
          total: 1,
        })
        .mockResolvedValue({
          data: [
            makeDocument({
              status: 'READY',
              failureReason: 'NO_EXTRACTABLE_TEXT',
              updatedAt: '2026-10-09T12:02:00.000Z',
            }),
          ],
          total: 1,
        });
      renderWithProviders(<DocumentsTable />);

      await screen.findByText('Atualizando');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: expect.stringContaining('Regimento Interno'),
        }),
      );
    });

    it('notifies success when an update finishes without failure', async () => {
      vi.mocked(knowledgeApi.listDocuments)
        .mockResolvedValueOnce({
          data: [makeDocument({ status: 'UPDATING', updatedAt: '2026-10-09T12:01:00.000Z' })],
          total: 1,
        })
        .mockResolvedValue({
          data: [makeDocument({ status: 'READY', updatedAt: '2026-10-09T12:02:00.000Z' })],
          total: 1,
        });
      renderWithProviders(<DocumentsTable />);

      await screen.findByText('Atualizando');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success', message: 'Regimento Interno atualizado.' }),
        ),
      );
    });
  });

  it('shows the empty message when there is no document', async () => {
    listReturns();
    renderWithProviders(<DocumentsTable />);

    expect(await screen.findByText(/nenhum documento enviado ainda/i)).toBeVisible();
  });
});
