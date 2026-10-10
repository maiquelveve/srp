import type { AxiosProgressEvent } from 'axios';
import { apiClient } from '@/services/api-client';
import type { Paginated } from '@/features/structure/types';
import type { KnowledgeDocumentItem, KnowledgeQueryItem } from './types';

export interface ListKnowledgeParams {
  /** Substring, sem diferenciar maiúsculas: nome do documento ou texto da pergunta. */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UploadKnowledgeDocumentInput {
  name: string;
  file: File;
}

export interface UpdateKnowledgeDocumentInput {
  name?: string;
  file?: File;
}

function buildFormData(fields: { name?: string; file?: File }): FormData {
  const formData = new FormData();
  if (fields.name !== undefined) {
    formData.append('name', fields.name);
  }
  if (fields.file) {
    formData.append('file', fields.file);
  }
  return formData;
}

/** Cliente dos endpoints de `/api/v1/knowledge` (contracts/knowledge-api.md). */
export const knowledgeApi = {
  ask: (question: string) =>
    apiClient.post<KnowledgeQueryItem>('/knowledge/queries', { question }).then((r) => r.data),

  listQueries: (params: ListKnowledgeParams = {}) =>
    apiClient
      .get<Paginated<KnowledgeQueryItem>>('/knowledge/queries', { params })
      .then((r) => r.data),

  listDocuments: (params: ListKnowledgeParams = {}) =>
    apiClient
      .get<Paginated<KnowledgeDocumentItem>>('/knowledge/documents', { params })
      .then((r) => r.data),

  uploadDocument: (
    input: UploadKnowledgeDocumentInput,
    onProgress?: (percent: number) => void,
  ): Promise<KnowledgeDocumentItem> =>
    apiClient
      .post<KnowledgeDocumentItem>('/knowledge/documents', buildFormData(input), {
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      })
      .then((r) => r.data),

  updateDocument: (id: number, input: UpdateKnowledgeDocumentInput) =>
    apiClient
      .put<KnowledgeDocumentItem>(`/knowledge/documents/${id}`, buildFormData(input))
      .then((r) => r.data),

  reprocessDocument: (id: number) =>
    apiClient
      .post<KnowledgeDocumentItem>(`/knowledge/documents/${id}/reprocess`)
      .then((r) => r.data),

  removeDocument: (id: number) => apiClient.delete(`/knowledge/documents/${id}`),
};
