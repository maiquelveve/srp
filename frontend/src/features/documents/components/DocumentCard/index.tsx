import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarIcon,
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  Loader2Icon,
  Trash2Icon,
} from 'lucide-react';
import { documentsApi } from '../../api';
import { extensionOf, formatDate, formatFileSize } from '../../format';
import type { DocumentItem } from '../../types';
import { notify } from '@/lib/notify';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface DocumentCardProps {
  document: DocumentItem;
  /** true = WARDEN ou SUPERVISOR — mostra o botão de remover (contracts/documents.md). */
  canManage: boolean;
}

/**
 * Um card por documento — ícone com glow dourado sutil, divisor vertical
 * antes do selo da extensão, divisor horizontal antes dos metadados.
 * Tamanho/data: rótulo pequeno em cima + valor em negrito embaixo, ícone ao
 * lado, divisor vertical entre as duas colunas. Rodapé igual à imagem de
 * referência do usuário: "Baixar" preenchido ocupando a maior parte da
 * linha + remover (hard delete, FR-012) em quadrado vermelho sólido ao
 * lado — remover só aparece pra quem pode gerenciar (WARDEN/SUPERVISOR).
 * Elevação e leve "lift" no hover (visual premium/futurista, não só
 * compacto) — espaço interno confiante, não espremido; o formato mais
 * próximo de quadrado vem da largura da coluna do grid (`DocumentsPage`),
 * não de cortar padding a ponto de ficar apertado.
 */
export default function DocumentCard({ document: doc, canManage }: DocumentCardProps): JSX.Element {
  const queryClient = useQueryClient();

  const download = useMutation({
    mutationFn: () => documentsApi.download(doc.id),
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: () =>
      notify({ title: 'Não foi possível baixar', message: 'Tente novamente', type: 'error' }),
  });

  const remove = useMutation({
    mutationFn: () => documentsApi.remove(doc.id),
    onSuccess: () => {
      notify({ message: `${doc.name} removido`, type: 'success' });
      // Chave parcial — atualiza tanto a lista da categoria quanto a
      // Biblioteca unificada (mesma lógica de UploadDocumentDialog).
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () =>
      notify({ title: 'Não foi possível remover', message: 'Tente novamente', type: 'error' }),
  });

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border-border/60 bg-gradient-to-b from-card to-card/60 shadow-lg shadow-black/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
      <CardContent className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-primary/50 bg-primary/10 text-primary shadow-[0_0_16px_-2px] shadow-primary/40 transition-shadow group-hover:shadow-primary/60">
              <FileTextIcon className="size-7" />
            </div>
            <Separator orientation="vertical" className="h-8 bg-border/70" />
            <Badge
              variant="outline"
              className="shrink-0 rounded-full border-border/70 px-3 py-0.5 font-mono text-xs tracking-wide text-muted-foreground"
            >
              {extensionOf(doc.originalFileName)}
            </Badge>
          </div>

          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 border-border text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2Icon className="size-4" />
                  <span className="sr-only">Remover</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover {doc.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O arquivo é apagado definitivamente. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className={cn(buttonVariants({ variant: 'destructive' }))}
                    onClick={() => remove.mutate()}
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-bold leading-snug">{doc.name}</p>
          <p className="truncate text-xs text-muted-foreground">{doc.originalFileName}</p>
        </div>

        <Separator className="bg-border/70" />

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 leading-tight">
              <p className="text-[11px] text-muted-foreground">Tamanho</p>
              <p className="truncate text-xs font-semibold">{formatFileSize(doc.sizeBytes)}</p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8 shrink-0 bg-border/70" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 leading-tight">
              <p className="text-[11px] text-muted-foreground">Data de envio</p>
              <p className="truncate text-xs font-semibold">{formatDate(doc.createdAt)}</p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-xl border-border text-foreground hover:bg-accent hover:text-accent-foreground"
          disabled={download.isPending}
          onClick={() => download.mutate()}
        >
          {download.isPending ? (
            <Loader2Icon className="size-3.5 animate-spin text-primary" />
          ) : (
            <DownloadIcon className="size-3.5 text-primary" />
          )}
          Baixar
        </Button>
      </CardContent>
    </Card>
  );
}
