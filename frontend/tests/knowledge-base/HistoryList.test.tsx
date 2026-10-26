import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HistoryList from '../../src/features/knowledge-base/components/HistoryList';
import { knowledgeApi } from '../../src/features/knowledge-base/api';
import { makeQuery, renderWithProviders } from './helpers';

vi.mock('../../src/features/knowledge-base/api', () => ({
  knowledgeApi: { listQueries: vi.fn() },
}));
vi.mock('../../src/lib/notify', () => ({ notify: vi.fn() }));

describe('HistoryList', () => {
  it('lists question, answer, author and date of every query', async () => {
    vi.mocked(knowledgeApi.listQueries).mockResolvedValue({
      data: [
        makeQuery({ id: 2, question: 'Pergunta do João', askedBy: { id: 2, name: 'João Lima' } }),
        makeQuery({ id: 1, question: 'Pergunta da Maria', answer: 'Resposta da Maria' }),
      ],
      total: 2,
    });
    renderWithProviders(<HistoryList />);

    expect(await screen.findByText('Pergunta do João')).toBeVisible();
    expect(screen.getByText('João Lima')).toBeVisible();
    expect(screen.getByText('Pergunta da Maria')).toBeVisible();
    expect(screen.getByText('Resposta da Maria')).toBeVisible();
    expect(screen.getAllByText(/\d{2}\/\d{2}\/\d{4}/)).toHaveLength(2);
  });

  it('marks NO_ANSWER and EXCERPTS_ONLY, and leaves a normal answer unmarked', async () => {
    vi.mocked(knowledgeApi.listQueries).mockResolvedValue({
      data: [
        makeQuery({ id: 3, question: 'Pergunta normal', outcome: 'ANSWERED' }),
        makeQuery({
          id: 2,
          question: 'Pergunta sem retorno',
          outcome: 'NO_ANSWER',
          answer: 'Não foi possível encontrar a resposta',
        }),
        makeQuery({ id: 1, question: 'Pergunta de trechos', outcome: 'EXCERPTS_ONLY' }),
      ],
      total: 3,
    });
    renderWithProviders(<HistoryList />);

    await screen.findByText('Pergunta normal');
    const article = (text: string): HTMLElement =>
      screen.getByText(text).closest('article') as HTMLElement;
    expect(
      within(article('Pergunta sem retorno')).getByText('Sem resposta', { selector: 'div' }),
    ).toBeVisible();
    expect(
      within(article('Pergunta de trechos')).getByText('Só trechos', { selector: 'div' }),
    ).toBeVisible();
    expect(
      within(article('Pergunta normal')).queryByText(/^(Sem resposta|Só trechos)$/),
    ).not.toBeInTheDocument();
  });

  it('has no edit, delete or any destructive action', async () => {
    vi.mocked(knowledgeApi.listQueries).mockResolvedValue({
      data: [
        makeQuery({ sources: [{ documentId: 1, documentName: 'Doc', position: 0, excerpt: 'x' }] }),
      ],
      total: 1,
    });
    renderWithProviders(<HistoryList />);

    await screen.findByText('Quais os passos da escolta hospitalar?');
    const buttons = screen
      .getAllByRole('button')
      .map((button) => button.textContent + button.ariaLabel);
    expect(buttons.join('|')).not.toMatch(/editar|excluir|apagar|remover|deletar/i);
  });

  it('searches by the question text only when Pesquisar is clicked', async () => {
    vi.mocked(knowledgeApi.listQueries).mockResolvedValue({ data: [makeQuery()], total: 1 });
    renderWithProviders(<HistoryList />);
    await screen.findByText('Quais os passos da escolta hospitalar?');
    expect(knowledgeApi.listQueries).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: undefined, offset: 0 }),
    );

    fireEvent.change(screen.getByLabelText('Texto da pergunta'), {
      target: { value: ' escolta ' },
    });
    expect(knowledgeApi.listQueries).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /pesquisar/i }));

    await waitFor(() =>
      expect(knowledgeApi.listQueries).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'escolta' }),
      ),
    );
  });

  it('shows distinct empty states with and without a search', async () => {
    vi.mocked(knowledgeApi.listQueries).mockResolvedValue({ data: [], total: 0 });
    renderWithProviders(<HistoryList />);
    expect(await screen.findByText(/nenhuma pergunta feita ainda/i)).toBeVisible();

    fireEvent.change(screen.getByLabelText('Texto da pergunta'), { target: { value: 'xyz' } });
    fireEvent.click(screen.getByRole('button', { name: /pesquisar/i }));

    expect(await screen.findByText(/nenhuma pergunta encontrada com esse texto/i)).toBeVisible();
  });
});
