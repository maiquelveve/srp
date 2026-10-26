import { BotMessageSquareIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react';
import type { KnowledgeQueryItem } from '../../types';
import SourcesDialog from '../SourcesDialog';

/** Aviso do contrato (knowledge-api.md) quando a IA de chat falhou e só há os trechos. */
const EXCERPTS_ONLY_NOTICE =
  'Não foi possível gerar uma resposta elaborada. Veja os trechos relevantes no ícone de referências.';

/** Avatar do assistente: mesmo quadrado `bg-accent` com ícone dourado dos cartões de destaque do projeto. */
export function AssistantAvatar(): JSX.Element {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
      <BotMessageSquareIcon className="size-4" />
    </div>
  );
}

/**
 * A resposta de uma pergunta, nos três resultados do contrato: `ANSWERED` (texto
 * da IA), `NO_ANSWER` (nada nos documentos) e `EXCERPTS_ONLY` (a IA de chat
 * falhou: aviso, e os trechos, que já são a própria resposta, ficam nas referências).
 * As referências são sempre um ícone com contador que abre um modal.
 */
export default function AnswerCard({ item }: { item: KnowledgeQueryItem }): JSX.Element {
  return (
    <div className="flex gap-3">
      <AssistantAvatar />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          {item.outcome === 'ANSWERED' && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {item.answer}
            </p>
          )}

          {item.outcome === 'NO_ANSWER' && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <SearchXIcon className="mt-0.5 size-4 shrink-0" />
              <p>{item.answer}</p>
            </div>
          )}

          {item.outcome === 'EXCERPTS_ONLY' && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <p>{EXCERPTS_ONLY_NOTICE}</p>
            </div>
          )}
        </div>

        <SourcesDialog sources={item.sources} />
      </div>
    </div>
  );
}
