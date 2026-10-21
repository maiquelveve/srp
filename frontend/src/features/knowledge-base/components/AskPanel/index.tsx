import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { FileTextIcon, InfoIcon, LoaderCircleIcon, MessageSquareTextIcon, SendIcon } from 'lucide-react';
import { knowledgeApi } from '../../api';
import type { KnowledgeQueryItem } from '../../types';
import AnswerCard from '../AnswerCard';
import { notify } from '@/lib/notify';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const QUESTION_MIN_LENGTH = 3;
const QUESTION_MAX_LENGTH = 1000;

export interface AskPanelProps {
  /** Atalho do aviso "sem documentos" para a aba Documentos. */
  onGoToDocuments: () => void;
}

/** Mensagens em português para cada erro do contrato (400, 429, 503). */
function describeAskError(error: unknown): string {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 400) {
    return `A pergunta precisa ter entre ${QUESTION_MIN_LENGTH} e ${QUESTION_MAX_LENGTH} caracteres.`;
  }
  if (status === 429) {
    return 'Muitas perguntas em pouco tempo. Aguarde um minuto e tente novamente.';
  }
  if (status === 503) {
    return 'O serviço de IA está indisponível agora. Tente novamente em instantes.';
  }
  return 'Tente novamente.';
}

/**
 * Aba "Chat": a pessoa pergunta em linguagem natural e vê a resposta com as
 * fontes. A conversa fica só nesta tela (estado local); o registro permanente
 * de cada pergunta é o histórico, gravado pelo backend.
 */
export default function AskPanel({ onGoToDocuments }: AskPanelProps): JSX.Element {
  const [question, setQuestion] = useState('');
  const [exchanges, setExchanges] = useState<KnowledgeQueryItem[]>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Edge case da spec: sem nenhum documento disponível não adianta perguntar.
  // Compartilha a família de chave 'knowledge-documents', então um envio recente invalida esta checagem.
  const documentsQuery = useQuery({
    queryKey: ['knowledge-documents', 'availability'],
    queryFn: () => knowledgeApi.listDocuments({ limit: 100 }),
  });
  const hasNoAvailableDocument =
    documentsQuery.isSuccess &&
    !documentsQuery.data.data.some(
      (document) => document.status === 'READY' || document.status === 'UPDATING',
    );

  const askMutation = useMutation({
    mutationFn: (text: string) => knowledgeApi.ask(text),
    onSuccess: (item) => {
      setExchanges((current) => [...current, item]);
      setQuestion('');
      // O histórico (aba própria) lista toda consulta gravada.
      void queryClient.invalidateQueries({ queryKey: ['knowledge-queries'] });
    },
    onError: (error) => {
      // A pergunta continua no campo para a pessoa tentar de novo sem redigitar.
      notify({ title: 'Não foi possível consultar', message: describeAskError(error), type: 'error' });
    },
  });

  const trimmedLength = question.trim().length;
  const canSubmit =
    trimmedLength >= QUESTION_MIN_LENGTH &&
    !askMutation.isPending &&
    !hasNoAvailableDocument;

  // Mantém a última pergunta/resposta à vista conforme a conversa cresce.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [exchanges.length, askMutation.isPending]);

  function submit(): void {
    if (canSubmit) {
      askMutation.mutate(question.trim());
    }
  }

  // Enter envia; Shift+Enter quebra a linha.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {hasNoAvailableDocument && (
        <Alert variant="info" size="sm" className="max-w-none">
          <InfoIcon />
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            <AlertDescription className="mt-0">
              Nenhum documento está disponível para consulta ainda. Carregue um documento para
              poder fazer perguntas.
            </AlertDescription>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 border-blue-50/40 bg-transparent text-blue-50 hover:bg-blue-50/10 hover:text-blue-50"
              onClick={onGoToDocuments}
            >
              <FileTextIcon className="size-4" />
              Ir para Documentos
            </Button>
          </div>
        </Alert>
      )}

      {exchanges.length === 0 && !askMutation.isPending ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <MessageSquareTextIcon className="size-8 text-primary" />
          <p className="text-sm font-medium">Pergunte algo sobre os documentos da base</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Ex.: quais os passos para fazer uma escolta hospitalar. A resposta usa somente o que
            está nos documentos carregados e mostra de onde veio.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {exchanges.map((item) => (
            <div key={item.id} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground">
                  {item.question}
                </p>
              </div>
              <AnswerCard item={item} />
            </div>
          ))}

          {askMutation.isPending && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground">
                  {askMutation.variables}
                </p>
              </div>
              <Card>
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin text-primary" />
                  Consultando os documentos...
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      <div ref={threadEndRef} />

      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua pergunta"
          rows={3}
          maxLength={QUESTION_MAX_LENGTH}
          disabled={askMutation.isPending || hasNoAvailableDocument}
          aria-label="Pergunta"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {question.length}/{QUESTION_MAX_LENGTH} · Enter envia, Shift+Enter quebra a linha
          </span>
          <Button type="button" className="gap-1.5" disabled={!canSubmit} onClick={submit}>
            {askMutation.isPending ? (
              <>
                <LoaderCircleIcon className="size-4 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <SendIcon className="size-4" />
                Enviar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
