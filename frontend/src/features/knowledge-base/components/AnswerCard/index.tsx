import { BookOpenTextIcon, ChevronDownIcon, FileTextIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react';
import type { KnowledgeQueryItem, KnowledgeQuerySource } from '../../types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

/** Aviso do contrato (knowledge-api.md) quando a IA de chat falhou e só há os trechos. */
const EXCERPTS_ONLY_NOTICE =
  'Não foi possível gerar uma resposta elaborada. Veja os trechos relevantes abaixo.';

/** Uma fonte: o nome do documento e, ao abrir, o trecho exato que foi usado. */
function SourceItem({
  source,
  defaultOpen,
}: {
  source: KnowledgeQuerySource;
  defaultOpen: boolean;
}): JSX.Element {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-md border border-border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent">
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{source.documentName}</span>
        {/* `position` começa em 0 no banco; a pessoa lê "Trecho 1" para o primeiro. */}
        <Badge variant="outline" className="shrink-0">
          Trecho {source.position + 1}
        </Badge>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {source.excerpt}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SourcesList({
  sources,
  defaultOpen,
}: {
  sources: KnowledgeQuerySource[];
  defaultOpen: boolean;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fontes</p>
      <div className="space-y-2">
        {sources.map((source) => (
          <SourceItem
            key={`${source.documentId}-${source.position}`}
            source={source}
            defaultOpen={defaultOpen}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A resposta de uma pergunta, nos três resultados do contrato: `ANSWERED` (texto
 * da IA e fontes), `NO_ANSWER` (nada nos documentos) e `EXCERPTS_ONLY` (a IA de
 * chat falhou: aviso e só os trechos, que já são a própria resposta).
 */
export default function AnswerCard({ item }: { item: KnowledgeQueryItem }): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-primary">
          <BookOpenTextIcon className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Resposta</span>
        </div>

        {item.outcome === 'ANSWERED' && (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.answer}</p>
            {item.sources.length > 0 && <SourcesList sources={item.sources} defaultOpen={false} />}
          </>
        )}

        {item.outcome === 'NO_ANSWER' && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <SearchXIcon className="mt-0.5 size-4 shrink-0" />
            <p>{item.answer}</p>
          </div>
        )}

        {item.outcome === 'EXCERPTS_ONLY' && (
          <>
            <Alert variant="warning" size="sm" className="max-w-none">
              <TriangleAlertIcon />
              <AlertDescription className="mt-0">{EXCERPTS_ONLY_NOTICE}</AlertDescription>
            </Alert>
            <SourcesList sources={item.sources} defaultOpen />
          </>
        )}
      </CardContent>
    </Card>
  );
}
