import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { FileTextIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import { knowledgeApi } from '../../api';
import type { KnowledgeDocumentItem } from '../../types';
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
import { cn } from '@/lib/utils';

// Mesmo filtro do envio: o backend detecta o formato pelo conteúdo e revalida tudo.
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const ACCEPTED_HINT = 'PDF, DOCX ou TXT, até 10 MB';

export interface EditDocumentDialogProps {
  document: KnowledgeDocumentItem;
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
 * "Editar" um documento da Base de Conhecimento: renomear e/ou enviar uma nova versão.
 * Com arquivo novo, o backend responde 202 e a versão atual continua valendo nas respostas
 * até a troca terminar; só renomear é imediato.
 */
export default function EditDocumentDialog({
  document,
  children,
}: EditDocumentDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(document.name);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // O estado nasce a cada abertura, não em useEffect (style guide, seção 5).
  function handleOpenChange(next: boolean): void {
    setName(document.name);
    setFile(null);
    setDragActive(false);
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
  }

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== document.name;
  const canSubmit = (nameChanged && trimmedName.length > 0) || file !== null;

  const mutation = useMutation({
    mutationFn: () =>
      knowledgeApi.updateDocument(document.id, {
        name: nameChanged ? trimmedName : undefined,
        file: file ?? undefined,
      }),
    onSuccess: () => {
      // Com arquivo novo não há aviso de sucesso aqui: o envio foi aceito, mas o resultado só se
      // sabe depois do processamento, e a tabela avisa (sucesso ou falha) quando ele termina.
      if (!file) {
        notify({ message: `${trimmedName} renomeado.`, type: 'success' });
      }
      void queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
      handleOpenChange(false);
    },
    onError: (error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message =
        status === 409
          ? 'Já existe um documento com esse nome, ou o documento está sendo processado'
          : status === 413
            ? 'Arquivo acima do tamanho máximo permitido'
            : status === 400
              ? 'Formato não permitido ou conteúdo não corresponde à extensão do arquivo'
              : 'Tente novamente';
      notify({ title: 'Não foi possível salvar', message, type: 'error' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
          <DialogDescription>
            Altere o nome ou envie uma nova versão. Enquanto a nova versão é processada, a atual
            continua sendo usada nas respostas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="knowledge-document-edit-name">Nome</Label>
            <Input
              id="knowledge-document-edit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Nova versão (opcional)</Label>
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
                  'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-input bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/50',
                  dragActive && 'border-primary bg-accent',
                )}
              >
                <UploadCloudIcon className="size-8 text-primary" />
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
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
