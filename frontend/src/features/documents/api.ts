import type { AxiosProgressEvent } from 'axios';
import { apiClient } from '@/services/api-client';
import type { Paginated } from '@/features/structure/types';
import type { DocumentCategory, DocumentItem } from './types';

export interface ListDocumentsParams {
  /** Omitido lista todas as categorias (tela "Biblioteca de Documentos"). */
  documentTypeId?: number;
  /** Substring, case-insensitive, contra o nome do documento. */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UploadDocumentInput {
  name: string;
  documentTypeId: number;
  file: File;
}

export interface DownloadedDocument {
  blob: Blob;
  fileName: string;
}

/** `Content-Disposition: attachment; filename="portaria.pdf"` -> `portaria.pdf`. */
function fileNameFromContentDisposition(header: string | undefined, fallback: string): string {
  const match = header ? /filename="?([^"]+)"?/.exec(header) : null;
  return match ? decodeURIComponent(match[1]) : fallback;
}

export const documentsApi = {
  listTypes: () => apiClient.get<DocumentCategory[]>('/document-types').then((r) => r.data),

  list: (params: ListDocumentsParams = {}) =>
    apiClient.get<Paginated<DocumentItem>>('/documents', { params }).then((r) => r.data),

  upload: (
    input: UploadDocumentInput,
    onProgress?: (percent: number) => void,
  ): Promise<DocumentItem> => {
    const formData = new FormData();
    formData.append('name', input.name);
    formData.append('documentTypeId', String(input.documentTypeId));
    formData.append('file', input.file);

    return apiClient
      .post<DocumentItem>('/documents', formData, {
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      })
      .then((r) => r.data);
  },

  download: async (id: number): Promise<DownloadedDocument> => {
    const response = await apiClient.get<Blob>(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    return {
      blob: response.data,
      fileName: fileNameFromContentDisposition(
        response.headers['content-disposition'] as string | undefined,
        `documento-${id}`,
      ),
    };
  },

  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/documents/${id}`).then((r) => r.data),
};
