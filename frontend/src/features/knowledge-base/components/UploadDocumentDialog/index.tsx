import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { FileTextIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import { knowledgeApi } from '../../api';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// Só o que o backend aceita. O backend detecta o formato pelo conteúdo e
// revalida tudo; este filtro é só para avisar cedo.
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const ACCEPTED_HINT = 'PDF, DOCX ou TXT, até 10 MB';

export interface UploadDocumentDialogProps {
  /** O gatilho (botão) vem de fora, como nos outros diálogos do projeto. */
  children: ReactNode;
}

function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * "Enviar documento" da Base de Conhecimento. O backend responde 202 e
 * processa em segundo plano, então o sucesso aqui significa "enviado", não
 * "pronto para consulta" (o estado aparece na tabela de documentos).
 */
export default function UploadDocumentDialog({
  children,
}: UploadDocumentDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  function resetState(): void {
    setName('');
    setFile(null);
    setDragActive(false);
    setProgress(0);
  }

  // Reset ao fechar fica aqui, não em useEffect (style guide, seção 5).
  function handleOpenChange(next: boolean): void {
    if (!next) {
      resetState();
    }
    setOpen(next);
  }

  function pickFile(selected: File | null): void {
    if (!selected) {
      return;
    }
    if (!hasAcceptedExtension(selected.name)) {
      notify({
        title: 'Formato não permitido',
        message: `Envie um arquivo ${ACCEPTED_HINT.toLowerCase()}`,
        type: 'error',
      });
      return;
    }
    setFile(selected);
    // Sugere o nome a partir do arquivo, sem sobrescrever o que já foi digitado.
    setName((current) => current || selected.name.replace(/\.[^.]+$/, ''));
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) {
        throw new Error('Arquivo não selecionado');
      }
      return knowledgeApi.uploadDocument({ name: name.trim(), file }, setProgress);
    },
    onSuccess: () => {
      notify({
        message: `${name.trim()} enviado. O processamento começou.`,
        type: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
      handleOpenChange(false);
    },
    onError: (error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message =
        status === 409
          ? 'Já existe um documento com esse nome na base'
          : status === 413
            ? 'Arquivo acima do tamanho máximo permitido'
            : status === 400
              ? 'Formato não permitido ou conteúdo não corresponde à extensão do arquivo'
              : 'Tente novamente';
      notify({ title: 'Não foi possível enviar', message, type: 'error' });
      setProgress(0);
    },
  });

  const canSubmit = name.trim().length > 0 && file !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>
            Adicione um documento à base de conhecimento. Ele será processado em segundo plano.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Arquivo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              className="hidden"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />

            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  pickFile(event.dataTransfer.files?.[0] ?? null);
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-input bg-muted/30 px-4 py-8 text-center transition-colors hover:bg-muted/50',
                  dragActive && 'border-primary bg-accent',
                )}
              >
                <UploadCloudIcon className="size-10 text-primary" />
                <span className="text-sm font-medium">Clique ou arraste o arquivo aqui</span>
                <span className="text-xs text-muted-foreground">{ACCEPTED_HINT}</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-input bg-muted/30 px-3 py-2.5">
                <FileTextIcon className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatMegabytes(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={mutation.isPending}
                  onClick={() => setFile(null)}
                >
                  <XIcon className="size-3.5" />
                  <span className="sr-only">Remover arquivo selecionado</span>
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="knowledge-document-name">Nome</Label>
            <Input
              id="knowledge-document-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Regimento Interno"
              disabled={mutation.isPending}
            />
          </div>

          {mutation.isPending && (
            <div className="grid gap-1.5">
              <p className="text-sm text-muted-foreground">Enviando documento... {progress}%</p>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
