import { FileTextIcon, HistoryIcon, MessageSquareTextIcon } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Bloco usado enquanto cada aba ainda não tem o conteúdo da sua user story. */
function ComingSoon({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/**
 * Base de Conhecimento (feature 003): perguntar em linguagem natural, ver o
 * histórico e gerir os documentos. Restrita a Supervisor e Chefia/Diretor
 * (FR-001); o backend revalida o perfil em toda chamada.
 */
export default function KnowledgeBasePage(): JSX.Element {
  const { user } = useAuth();
  const canAccess = user?.role === 'WARDEN' || user?.role === 'SUPERVISOR';

  if (!canAccess) {
    return <Navigate to="/inicio" replace />;
  }

  return (
    <div className="space-y-6 p-6">
      <Tabs defaultValue="ask" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ask" className="gap-2">
            <MessageSquareTextIcon className="size-4" />
            Perguntar
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <HistoryIcon className="size-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileTextIcon className="size-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ask">
          <ComingSoon message="Aqui você fará perguntas em linguagem natural sobre os documentos carregados." />
        </TabsContent>
        <TabsContent value="history">
          <ComingSoon message="Aqui ficará o histórico de perguntas e respostas." />
        </TabsContent>
        <TabsContent value="documents">
          <ComingSoon message="Aqui você carregará e gerenciará os documentos da base de conhecimento." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
