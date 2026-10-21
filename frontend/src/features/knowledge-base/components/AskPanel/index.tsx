import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  FileTextIcon,
  InfoIcon,
  LoaderCircleIcon,
  MessageSquareTextIcon,
  SendIcon,
} from 'lucide-react';
import { knowledgeApi } from '../../api';
import type { KnowledgeQueryItem } from '../../types';
import AnswerCard, { AssistantAvatar } from '../AnswerCard';
import { notify } from '@/lib/notify';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const QUESTION_MIN_LENGTH = 3;
const QUESTION_MAX_LENGTH = 1000;
/** Menor altura do painel, para o Chat continuar usável em janelas baixas. */
const MIN_PANEL_HEIGHT_PX = 420;
/** Folga até a borda inferior da janela: padding da página (24) mais a margem do AppShell (8). */
const BOTTOM_SPACING_PX = 32;

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

/** Balão da pergunta: fundo primário com o texto do par `primary-foreground`, que garante o contraste. */
function QuestionBubble({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex justify-end">
      <p className="max-w-[75%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
        {text}
      </p>
    </div>
  );
}

/**
 * Aba "Chat": a pessoa pergunta em linguagem natural e vê a resposta, com as
 * referências num ícone que abre um modal. A conversa fica só nesta tela
 * (estado local); o registro permanente de cada pergunta é o histórico,
 * gravado pelo backend.
 */
export default function AskPanel({ onGoToDocuments }: AskPanelProps): JSX.Element {
  const [question, setQuestion] = useState('');
  const [exchanges, setExchanges] = useState<KnowledgeQueryItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // O AppShell não limita a altura da área de conteúdo (quem rola é a janela inteira),
  // então um campo "fixo embaixo" não funcionaria sozinho. O painel recebe a altura que
  // sobra da tela abaixo dele; assim só a conversa rola e o campo de pergunta fica no
  // limite inferior, como num chat. Recalcula quando a janela muda de tamanho.
  useLayoutEffect(() => {
    function fitToViewport(): void {
      const panelTop = (panelRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
      setPanelHeight(
        Math.max(MIN_PANEL_HEIGHT_PX, window.innerHeight - panelTop - BOTTOM_SPACING_PX),
      );
    }
    fitToViewport();
    window.addEventListener('resize', fitToViewport);
    return () => window.removeEventListener('resize', fitToViewport);
  }, []);

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
      notify({
        title: 'Não foi possível consultar',
        message: describeAskError(error),
        type: 'error',
      });
    },
  });

  const trimmedLength = question.trim().length;
  const canSubmit =
    trimmedLength >= QUESTION_MIN_LENGTH && !askMutation.isPending && !hasNoAvailableDocument;

  // Leva a conversa ao fim a cada pergunta, resposta ou espera. Rola o próprio painel,
  // não a janela (`scrollIntoView` mexeria nas duas).
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
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

  const isConversationEmpty = exchanges.length === 0 && !askMutation.isPending;

  return (
    <div
      ref={panelRef}
      className="flex w-full flex-col gap-4"
      style={{ height: panelHeight ?? undefined, minHeight: MIN_PANEL_HEIGHT_PX }}
    >
      {hasNoAvailableDocument && (
        <Alert variant="info" size="sm" className="max-w-none shrink-0">
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

      {/* Só esta área rola; o campo de pergunta abaixo fica sempre à vista. */}
      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isConversationEmpty ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-accent text-primary">
              <MessageSquareTextIcon className="size-6" />
            </div>
            <p className="text-base font-semibold">Pergunte algo sobre os documentos da base</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Ex.: quais os passos para fazer uma escolta hospitalar. A resposta usa somente o que
              está nos documentos carregados, e as referências mostram de onde veio.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {exchanges.map((item) => (
              <div key={item.id} className="space-y-4">
                <QuestionBubble text={item.question} />
                <AnswerCard item={item} />
              </div>
            ))}

            {askMutation.isPending && (
              <div className="space-y-4">
                <QuestionBubble text={askMutation.variables} />
                <div className="flex gap-3">
                  <AssistantAvatar />
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                    <LoaderCircleIcon className="size-4 animate-spin text-primary" />
                    Consultando os documentos... pode levar alguns instantes.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 rounded-lg border border-input bg-card p-2 transition-shadow focus-within:ring-2 focus-within:ring-ring">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua pergunta"
          rows={2}
          maxLength={QUESTION_MAX_LENGTH}
          disabled={askMutation.isPending || hasNoAvailableDocument}
          aria-label="Pergunta"
          className="min-h-[56px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <span className="text-xs text-muted-foreground">
            {question.length}/{QUESTION_MAX_LENGTH} · Enter envia, Shift+Enter quebra a linha
          </span>
          <Button
            type="button"
            size="icon"
            className="size-9"
            disabled={!canSubmit}
            onClick={submit}
            aria-label="Enviar pergunta"
          >
            {askMutation.isPending ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
