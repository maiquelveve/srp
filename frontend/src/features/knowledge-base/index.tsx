import { useState } from 'react';
import { FileTextIcon, HistoryIcon, MessageSquareTextIcon } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AskPanel from './components/AskPanel';
import DocumentsTable from './components/DocumentsTable';
import HistoryList from './components/HistoryList';

/**
 * Base de Conhecimento (feature 003): perguntar em linguagem natural, ver o
 * histórico e gerir os documentos. Restrita a Supervisor e Chefia/Diretor
 * (FR-001); o backend revalida o perfil em toda chamada.
 */
export default function KnowledgeBasePage(): JSX.Element {
  const { user } = useAuth();
  // Controlada para o aviso do Chat poder levar a pessoa direto à aba Documentos.
  const [activeTab, setActiveTab] = useState('ask');
  const canAccess = user?.role === 'WARDEN' || user?.role === 'SUPERVISOR';

  if (!canAccess) {
    return <Navigate to="/inicio" replace />;
  }

  return (
    <div className="space-y-6 p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="ask" className="gap-2">
            <MessageSquareTextIcon className="size-4" />
            Chat
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
          <AskPanel onGoToDocuments={() => setActiveTab('documents')} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryList />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
