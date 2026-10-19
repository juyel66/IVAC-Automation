export type DocumentRole = 'primary' | 'additional';
export type DocumentStatus = 'ready' | 'uploading' | 'uploaded' | 'error';

export interface DocumentMetadata {
  id: string;
  profileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  role: DocumentRole;
  orderIndex: number; // 0 for primary, 1..3 for additional
  applicantName?: string;
  uploadedAt: number;
  status: DocumentStatus;
  errorMessage?: string;
}

export interface StoredDocumentBinary {
  id: string;
  profileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  data: ArrayBuffer | Blob;
  savedAt: number;
}

export const MAX_PDF_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max per IVAC standard
export const ALLOWED_MIME_TYPES = ['application/pdf'];
