import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AskPanel from '../../src/features/knowledge-base/components/AskPanel';
import { knowledgeApi } from '../../src/features/knowledge-base/api';
import type { KnowledgeQueryItem } from '../../src/features/knowledge-base/types';
import { makeDocument, makeQuery, renderWithProviders } from './helpers';

vi.mock('../../src/features/knowledge-base/api', () => ({
  knowledgeApi: { ask: vi.fn(), listDocuments: vi.fn() },
}));
vi.mock('../../src/lib/notify', () => ({ notify: vi.fn() }));

const QUESTION = 'Quais os passos da escolta hospitalar?';

function withAvailableDocument(): void {
  vi.mocked(knowledgeApi.listDocuments).mockResolvedValue({
    data: [makeDocument({ status: 'READY' })],
    total: 1,
  });
}

async function typeQuestion(text = QUESTION): Promise<HTMLTextAreaElement> {
  const field = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: text } });
  return field;
}

const sendButton = (): HTMLElement => screen.getByRole('button', { name: /enviar/i });

describe('AskPanel', () => {
  beforeEach(() => {
    withAvailableDocument();
  });

  it('sends the trimmed question and shows the answer', async () => {
    vi.mocked(knowledgeApi.ask).mockResolvedValue(makeQuery({ question: QUESTION }));
    renderWithProviders(<AskPanel onGoToDocuments={() => {}} />);

    await typeQuestion(`  ${QUESTION}  `);
    fireEvent.click(sendButton());

    expect(await screen.findByText('Os passos são: 1) algemar, 2) conduzir.')).toBeInTheDocument();
    expect(knowledgeApi.ask).toHaveBeenCalledWith(QUESTION);
    // O campo é limpo depois de responder.
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('keeps send disabled for a question shorter than 3 characters', async () => {
    renderWithProviders(<AskPanel onGoToDocuments={() => {}} />);

    await typeQuestion('ab');

    expect(sendButton()).toBeDisabled();
  });

  it('blocks a second submission while the first is waiting for the answer', async () => {
    let resolveAnswer: (item: KnowledgeQueryItem) => void = () => {};
    vi.mocked(knowledgeApi.ask).mockReturnValue(
      new Promise<KnowledgeQueryItem>((resolve) => {
        resolveAnswer = resolve;
      }),
    );
    renderWithProviders(<AskPanel onGoToDocuments={() => {}} />);

    const field = await typeQuestion();
    fireEvent.click(sendButton());
    await waitFor(() => expect(sendButton()).toBeDisabled());
    // Enter também é bloqueado, não só o clique.
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.click(sendButton());

    expect(knowledgeApi.ask).toHaveBeenCalledTimes(1);
    resolveAnswer(makeQuery());
    await screen.findByText('Os passos são: 1) algemar, 2) conduzir.');
  });

  it('shows the sources icon with a count and opens the excerpts in a modal', async () => {
    vi.mocked(knowledgeApi.ask).mockResolvedValue(
      makeQuery({
        sources: [
          {
            documentId: 7,
            documentName: 'Procedimento de Escolta',
            position: 2,
            excerpt: 'texto do trecho',
          },
        ],
      }),
    );
    renderWithProviders(<AskPanel onGoToDocuments={() => {}} />);

    await typeQuestion();
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByRole('button', { name: /ver referências \(1\)/i }));

    expect(await screen.findByText('Procedimento de Escolta')).toBeInTheDocument();
    expect(screen.getByText('texto do trecho')).toBeInTheDocument();
    expect(screen.getByText('Trecho 3')).toBeInTheDocument();
  });

  it('shows the raw-excerpts notice, and not the excerpts text, when the chat AI failed', async () => {
    vi.mocked(knowledgeApi.ask).mockResolvedValue(
      makeQuery({
        outcome: 'EXCERPTS_ONLY',
        answer: 'Trechos mais relevantes encontrados: [1] Documento',
        sources: [{ documentId: 7, documentName: 'Doc', position: 0, excerpt: 'trecho bruto' }],
      }),
    );
    renderWithProviders(<AskPanel onGoToDocuments={() => {}} />);

    await typeQuestion();
    fireEvent.click(sendButton());

    expect(
      await screen.findByText(/não foi possível gerar uma resposta elaborada/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver referências \(1\)/i })).toBeInTheDocument();
  });

  it('shows the no-answer message in its own style', async () => {
    vi.mocked(knowledgeApi.ask).mockResolvedValue(
      makeQuery({ outcome: 'NO_ANSWER', answer: 'Não foi possível encontrar a resposta' }),
    );
    renderWithProviders(<AskPanel onGoToDocuments={() => {}} />);

    await typeQuestion();
    fireEvent.click(sendButton());

    expect(await screen.findByText('Não foi possível encontrar a resposta')).toBeInTheDocument();
  });

  it('warns and blocks asking when no document is available, with a shortcut to Documents', async () => {
    vi.mocked(knowledgeApi.listDocuments).mockResolvedValue({
      data: [makeDocument({ status: 'PROCESSING' })],
      total: 1,
    });
    const onGoToDocuments = vi.fn();
    renderWithProviders(<AskPanel onGoToDocuments={onGoToDocuments} />);

    const field = await typeQuestion();
    await waitFor(() => expect(sendButton()).toBeDisabled());
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(knowledgeApi.ask).not.toHaveBeenCalled();

    const shortcut = screen.getByRole('button', { name: /documentos/i });
    fireEvent.click(shortcut);
    expect(onGoToDocuments).toHaveBeenCalled();
  });
});
