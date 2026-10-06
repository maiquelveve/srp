import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { FileTextIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import { documentsApi } from '../../api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
const ACCEPTED_HINT = 'PDF, DOCX, DOC ou TXT, até 10 MB';

export interface UploadDocumentDialogProps {
  /** Omitido (tela "Biblioteca de Documentos") mostra um campo pra escolher a categoria. */
  documentTypeId?: number;
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
 * "Enviar documento" (FR-010, WARDEN/SUPERVISOR) — seletor de arquivo com
 * arrastar-e-soltar e barra de progresso real durante o envio (percentual
 * de `onUploadProgress`, não um spinner indefinido), seguindo
 * `docs/style-guide.md` (só tokens do sistema: `border-input`, `bg-muted`,
 * `border-primary`, nunca cor solta).
 */
export default function UploadDocumentDialog({
  documentTypeId: fixedDocumentTypeId,
  children,
}: UploadDocumentDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState<number | undefined>(fixedDocumentTypeId);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Só busca as categorias quando precisa escolher uma (tela unificada) —
  // vindo de uma categoria já fixa (telas Formulários/Modelos/Manuais), o
  // campo nem aparece.
  const typesQuery = useQuery({
    queryKey: ['document-types'],
    queryFn: documentsApi.listTypes,
    enabled: fixedDocumentTypeId === undefined,
  });

  function resetState(): void {
    setName('');
    setDocumentTypeId(fixedDocumentTypeId);
    setFile(null);
    setDragActive(false);
    setProgress(0);
  }

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
    setName((current) => current || selected.name.replace(/\.[^.]+$/, ''));
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!file || documentTypeId === undefined) {
        throw new Error('Arquivo ou categoria não selecionados');
      }
      return documentsApi.upload({ name: name.trim(), documentTypeId, file }, setProgress);
    },
    onSuccess: () => {
      notify({ message: `${name.trim()} enviado com sucesso`, type: 'success' });
      // Chave parcial — invalida tanto a lista da categoria quanto a
      // Biblioteca unificada, qualquer que seja a combinação de
      // filtros/página em cache no momento (ambas as telas usam ['documents', ...]).
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      handleOpenChange(false);
    },
    onError: (error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message =
        status === 409
          ? 'Já existe um documento com esse nome nesta categoria'
          : status === 413
            ? 'Arquivo acima do tamanho máximo permitido'
            : status === 400
              ? 'Formato não permitido ou conteúdo não corresponde à extensão do arquivo'
              : 'Tente novamente';
      notify({ title: 'Não foi possível enviar', message, type: 'error' });
      setProgress(0);
    },
  });

  const canSubmit = name.trim().length > 0 && file !== null && documentTypeId !== undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>Adicione um documento à biblioteca.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Arquivo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />

            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  pickFile(e.dataTransfer.files?.[0] ?? null);
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
            <Label htmlFor="document-name">Nome</Label>
            <Input
              id="document-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Portaria de Transferência"
              disabled={mutation.isPending}
            />
          </div>

          {fixedDocumentTypeId === undefined && (
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={documentTypeId !== undefined ? String(documentTypeId) : ''}
                onValueChange={(value) => setDocumentTypeId(Number(value))}
                disabled={mutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {(typesQuery.data ?? []).map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
