import { BookOpenTextIcon, FileTextIcon } from 'lucide-react';
import type { KnowledgeQuerySource } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface SourcesDialogProps {
  sources: KnowledgeQuerySource[];
}

/**
 * Ícone de referências de uma resposta: mostra quantos trechos foram usados e,
 * ao clicar, abre um modal com o documento de origem e o texto exato de cada
 * trecho. O gatilho fica aqui dentro (e não vem de fora) porque o ícone com
 * contador é sempre o mesmo em toda resposta.
 */
export default function SourcesDialog({ sources }: SourcesDialogProps): JSX.Element | null {
  if (sources.length === 0) {
    return null;
  }

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground transition-colors hover:bg-info/10 hover:text-info"
              aria-label={`Ver referências (${sources.length})`}
            >
              <BookOpenTextIcon className="size-4" />
              <span className="text-xs font-medium">{sources.length}</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Ver referências</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Referências</DialogTitle>
          <DialogDescription>
            Trechos dos documentos que serviram de base para esta resposta.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {sources.map((source) => (
            <div
              key={`${source.documentId}-${source.position}`}
              className="overflow-hidden rounded-md border border-border"
            >
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <FileTextIcon className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {source.documentName}
                </span>
                {/* `position` começa em 0 no banco; a pessoa lê "Trecho 1" para o primeiro. */}
                <Badge variant="outline" className="shrink-0">
                  Trecho {source.position + 1}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed text-muted-foreground">
                {source.excerpt}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
