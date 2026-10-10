/** Estados de um documento (contracts/knowledge-api.md). Só READY e UPDATING entram nas respostas. */
export type KnowledgeDocumentStatus =
  'PROCESSING' | 'READY' | 'UPDATING' | 'FAILED' | 'NEEDS_REPROCESS';

/** Formato do arquivo, detectado pelo conteúdo no backend. */
export type KnowledgeFileFormat = 'pdf' | 'docx' | 'txt';

export interface KnowledgeUserSummary {
  id: number;
  name: string;
}

export interface KnowledgeDocumentItem {
  id: number;
  name: string;
  fileFormat: KnowledgeFileFormat;
  originalFileName: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  /** Código do motivo da falha (ex.: NO_EXTRACTABLE_TEXT); em READY indica falha da última atualização. */
  failureReason: string | null;
  chunkCount: number;
  uploadedBy: KnowledgeUserSummary;
  createdAt: string;
  updatedAt: string;
}

/**
 * ANSWERED: resposta gerada pela IA. NO_ANSWER: nada relevante nos documentos.
 * EXCERPTS_ONLY: a IA de chat falhou e a resposta são os trechos brutos.
 */
export type KnowledgeQueryOutcome = 'ANSWERED' | 'NO_ANSWER' | 'EXCERPTS_ONLY';

export interface KnowledgeQuerySource {
  documentId: number;
  documentName: string;
  position: number;
  excerpt: string;
}

export interface KnowledgeQueryItem {
  id: number;
  question: string;
  answer: string;
  outcome: KnowledgeQueryOutcome;
  sources: KnowledgeQuerySource[];
  askedBy: KnowledgeUserSummary;
  createdAt: string;
}
