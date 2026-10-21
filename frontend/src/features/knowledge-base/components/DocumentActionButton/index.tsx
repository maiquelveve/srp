import { useMutation } from '@tanstack/react-query';
import { CircleAlertIcon, EyeIcon, LoaderCircleIcon } from 'lucide-react';
import { knowledgeApi } from '../../api';
import type { KnowledgeDocumentItem } from '../../types';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Motivos de falha devolvidos pelo backend, na linguagem de quem usa a tela. */
const FAILURE_REASON_LABEL: Record<string, string> = {
  NO_EXTRACTABLE_TEXT: 'O arquivo não tem texto que possa ser lido (pode ser um PDF escaneado).',
  CORRUPTED_FILE: 'O arquivo está corrompido ou não pôde ser aberto.',
  AI_UNAVAILABLE: 'O serviço de IA estava indisponível. Tente reprocessar mais tarde.',
  INTERRUPTED: 'O processamento foi interrompido. Tente reprocessar.',
  UNKNOWN: 'Erro inesperado ao processar o documento.',
};

const NEEDS_REPROCESS_MESSAGE =
  'O documento precisa ser reprocessado para voltar a ser usado nas respostas.';

function describeFailure(code: string | null): string {
  // Um código novo no backend, ainda não mapeado aqui, cai no texto genérico.
  return FAILURE_REASON_LABEL[code ?? 'UNKNOWN'] ?? FAILURE_REASON_LABEL.UNKNOWN;
}

/**
 * Abre o arquivo original. PDF e TXT o navegador exibe numa aba nova; DOCX ele
 * não sabe exibir, então vira download.
 */
function useOpenDocument(document: KnowledgeDocumentItem) {
  return useMutation({
    mutationFn: async () => {
      // A aba é aberta já, dentro do clique, porque os navegadores bloqueiam
      // `window.open` chamado depois de uma espera (a requisição abaixo).
      const isViewable = document.fileFormat !== 'docx';
      const viewerTab = isViewable ? window.open('', '_blank') : null;
      try {
        const blob = await knowledgeApi.getDocumentFile(document.id);
        const url = URL.createObjectURL(blob);
        if (viewerTab) {
          viewerTab.location.href = url;
        } else {
          const link = window.document.createElement('a');
          link.href = url;
          link.download = document.originalFileName;
          link.click();
        }
        // Dá tempo de a aba carregar antes de liberar a memória do Blob.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (error) {
        viewerTab?.close();
        throw error;
      }
    },
    onError: () => {
      notify({
        title: 'Não foi possível abrir',
        message: 'O arquivo não foi encontrado ou o servidor não respondeu. Tente novamente.',
        type: 'error',
      });
    },
  });
}

/**
 * Ícone da coluna "Ações": avisa o que houve (com tooltip) quando o documento
 * falhou ou precisa de reprocesso, e abre o documento quando ele está disponível.
 */
export default function DocumentActionButton({
  document,
}: {
  document: KnowledgeDocumentItem;
}): JSX.Element | null {
  const openDocument = useOpenDocument(document);

  if (document.status === 'FAILED' || document.status === 'NEEDS_REPROCESS') {
    const message =
      document.status === 'FAILED' ? describeFailure(document.failureReason) : NEEDS_REPROCESS_MESSAGE;
    const colorClass = document.status === 'FAILED' ? 'text-destructive' : 'text-warning';
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Ver motivo: ${message}`}
          >
            <CircleAlertIcon className={`size-4 ${colorClass}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{message}</TooltipContent>
      </Tooltip>
    );
  }

  if (document.status === 'READY') {
    // Documento disponível cuja última atualização falhou: o aviso vai junto no tooltip.
    const tooltip =
      document.failureReason !== null
        ? `Visualizar documento. A última atualização falhou: ${describeFailure(document.failureReason)}`
        : 'Visualizar documento';
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            // Neutro em repouso e azul suave no hover: não repete o dourado das ações
            // principais nem compete com os Badges verde/vermelho da linha.
            className="size-7 text-muted-foreground transition-colors hover:bg-info/10 hover:text-info"
            disabled={openDocument.isPending}
            aria-label="Visualizar documento"
            onClick={() => openDocument.mutate()}
          >
            {openDocument.isPending ? (
              <LoaderCircleIcon className="size-4 animate-spin text-info" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  // PROCESSING e UPDATING: nada a mostrar ainda; o Badge já diz o que está acontecendo.
  return null;
}
