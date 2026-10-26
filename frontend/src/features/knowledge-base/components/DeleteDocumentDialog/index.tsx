import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeApi } from '../../api';
import type { KnowledgeDocumentItem } from '../../types';
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
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DeleteDocumentDialogProps {
  document: KnowledgeDocumentItem;
  /** O gatilho (botão) vem de fora, como nos outros diálogos do projeto. */
  children: ReactNode;
}

/**
 * Exclusão definitiva: remove o documento, seus trechos e o arquivo. O histórico de
 * perguntas e respostas é mantido (as respostas antigas continuam consultáveis).
 */
export default function DeleteDocumentDialog({
  document,
  children,
}: DeleteDocumentDialogProps): JSX.Element {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => knowledgeApi.removeDocument(document.id),
    onSuccess: () => {
      notify({ message: `${document.name} excluído`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
    },
    onError: () => {
      notify({ title: 'Não foi possível excluir', message: 'Tente novamente', type: 'error' });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {document.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            O documento e o arquivo serão apagados e ele deixará de ser usado nas respostas. Esta
            ação não pode ser desfeita. O histórico de consultas é mantido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={() => mutation.mutate()}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
