import { CheckIcon, CircleHelpIcon, InfoIcon } from 'lucide-react';
import type { ReportHelp } from '../../helpContent';
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

/**
 * Botão de ajuda + modal que explica a aba: para que serve, o que cada coluna
 * mostra e como o relatório é calculado. Texto vem de `helpContent.ts`.
 */
export default function ReportHelpDialog({ help }: { help: ReportHelp }): JSX.Element {
  const Icon = help.icon;

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" aria-label={`Como funciona: ${help.title}`}>
              <CircleHelpIcon />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Como esta aba funciona</TooltipContent>
      </Tooltip>

      <DialogContent className="max-h-[90vh] max-w-xl gap-5 overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-4 pr-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <Icon className="size-6" />
            </span>
            <div className="grid min-w-0 gap-1">
              <DialogTitle className="text-lg">{help.title}</DialogTitle>
              <DialogDescription>{help.summary}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <h3 className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold">
            O que aparece na tela
          </h3>
          <dl className="divide-y divide-border">
            {help.shows.map((item) => (
              <div
                key={item.label}
                className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4"
              >
                <dt className="font-medium">{item.label}</dt>
                <dd className="text-muted-foreground">{item.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Como funciona</h3>
          <ul className="grid gap-2">
            {help.howItWorks.map((step) => (
              <li key={step} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckIcon className="size-3" />
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </section>

        {help.note && (
          <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 p-3 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" />
            <p>{help.note}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
