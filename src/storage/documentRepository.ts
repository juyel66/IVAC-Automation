import { DocumentMetadata, StoredDocumentBinary } from '../types/document';
import { IvacAssistantError, ErrorCodes } from '../utils/errors';

const DB_NAME = 'ivac_assistant_db';
const DB_VERSION = 1;
const STORE_METADATA = 'document_metadata';
const STORE_BINARIES = 'document_binaries';

/**
 * Native IndexedDB implementation with Promise wrappers.
 * Works seamlessly in Chrome Extension content scripts, extension popups,
 * background service workers, and unit test environments with fake-indexeddb.
 */
class DocumentStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new IvacAssistantError(
          ErrorCodes.IDB_STORAGE_FAILED,
          'IndexedDB is not supported in this browser environment.'
        ));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for document metadata
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          const metaStore = db.createObjectStore(STORE_METADATA, { keyPath: 'id' });
          metaStore.createIndex('profileId', 'profileId', { unique: false });
          metaStore.createIndex('role', 'role', { unique: false });
          metaStore.createIndex('orderIndex', 'orderIndex', { unique: false });
        }

        // Store for actual PDF binary chunks/Blobs
        if (!db.objectStoreNames.contains(STORE_BINARIES)) {
          const binaryStore = db.createObjectStore(STORE_BINARIES, { keyPath: 'id' });
          binaryStore.createIndex('profileId', 'profileId', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new IvacAssistantError(
          ErrorCodes.IDB_STORAGE_FAILED,
          'Failed to initialize IndexedDB for document storage.',
          request.error?.message
        ));
      };
    });

    return this.dbPromise;
  }

  /**
   * Save a PDF file into IndexedDB and save its metadata
   */
  async saveDocument(
    profileId: string,
    file: File | Blob,
    fileName: string,
    role: 'primary' | 'additional',
    orderIndex: number,
    applicantName?: string
  ): Promise<DocumentMetadata> {
    const db = await this.getDB();
    const docId = `doc_${profileId}_${role}_${orderIndex}_${Date.now()}`;

    // Read bytes as ArrayBuffer for clean cross-context persistence
    const arrayBuffer = await file.arrayBuffer();

    const metadata: DocumentMetadata = {
      id: docId,
      profileId,
      fileName,
      fileSize: file.size,
      mimeType: file.type || 'application/pdf',
      role,
      orderIndex,
      applicantName,
      uploadedAt: Date.now(),
      status: 'ready'
    };

    const binaryData: StoredDocumentBinary = {
      id: docId,
      profileId,
      fileName,
      fileSize: file.size,
      mimeType: file.type || 'application/pdf',
      data: arrayBuffer,
      savedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_METADATA, STORE_BINARIES], 'readwrite');
      const metaStore = tx.objectStore(STORE_METADATA);
      const binaryStore = tx.objectStore(STORE_BINARIES);

      metaStore.put(metadata);
      binaryStore.put(binaryData);

      tx.oncomplete = () => {
        resolve(metadata);
      };

      tx.onerror = () => {
        reject(new IvacAssistantError(
          ErrorCodes.IDB_STORAGE_FAILED,
          `Failed to save PDF document "${fileName}" into IndexedDB.`,
          tx.error?.message
        ));
      };
    });
  }

  /**
   * Get all document metadata belonging to a specific profile
   */
  async getDocumentsByProfileId(profileId: string): Promise<DocumentMetadata[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_METADATA, 'readonly');
      const store = tx.objectStore(STORE_METADATA);
      const index = store.index('profileId');
      const request = index.getAll(profileId);

      request.onsuccess = () => {
        const docs = request.result as DocumentMetadata[];
        // Sort documents: primary (orderIndex 0) first, then additionals by orderIndex (1, 2, 3)
        docs.sort((a, b) => a.orderIndex - b.orderIndex);
        resolve(docs);
      };

      request.onerror = () => {
        reject(new IvacAssistantError(
          ErrorCodes.IDB_STORAGE_FAILED,
          'Failed to retrieve document metadata from IndexedDB.',
          request.error?.message
        ));
      };
    });
  }

  /**
   * Retrieve the binary data (Blob) for a document
   */
  async getDocumentBinary(documentId: string): Promise<Blob | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BINARIES, 'readonly');
      const store = tx.objectStore(STORE_BINARIES);
      const request = store.get(documentId);

      request.onsuccess = () => {
        const result = request.result as StoredDocumentBinary | undefined;
        if (!result) {
          resolve(null);
          return;
        }

        const blob = new Blob([result.data], { type: result.mimeType || 'application/pdf' });
        resolve(blob);
      };

      request.onerror = () => {
        reject(new IvacAssistantError(
          ErrorCodes.IDB_STORAGE_FAILED,
          'Failed to read document binary from IndexedDB.',
          request.error?.message
        ));
      };
    });
  }

  /**
   * Delete a single document by its ID
   */
  async deleteDocument(documentId: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_METADATA, STORE_BINARIES], 'readwrite');
      const metaStore = tx.objectStore(STORE_METADATA);
      const binaryStore = tx.objectStore(STORE_BINARIES);

      metaStore.delete(documentId);
      binaryStore.delete(documentId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        reject(new IvacAssistantError(
          ErrorCodes.IDB_STORAGE_FAILED,
          'Failed to delete document from IndexedDB.',
          tx.error?.message
        ));
      };
    });
  }

  /**
   * Delete all documents belonging to a profile (used when a profile is deleted)
   */
  async deleteDocumentsForProfile(profileId: string): Promise<void> {
    const docs = await this.getDocumentsByProfileId(profileId);
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_METADATA, STORE_BINARIES], 'readwrite');
      const metaStore = tx.objectStore(STORE_METADATA);
      const binaryStore = tx.objectStore(STORE_BINARIES);

      for (const doc of docs) {
        metaStore.delete(doc.id);
        binaryStore.delete(doc.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        reject(new IvacAssistantError(
          ErrorCodes.IDB_STORAGE_FAILED,
          'Failed to delete profile documents from IndexedDB.',
          tx.error?.message
        ));
      };
    });
  }
}

export const documentRepository = new DocumentStorageService();
