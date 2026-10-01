export type DocumentTypeCode = 'FORM' | 'TEMPLATE' | 'MANUAL';

export interface DocumentCategory {
  id: number;
  code: DocumentTypeCode;
  label: string;
}

export interface DocumentItem {
  id: number;
  name: string;
  originalFileName: string;
  sizeBytes: number;
  documentTypeId: number;
  createdAt: string;
}
