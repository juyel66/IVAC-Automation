import { DocumentMetadata } from '../../types/document';
import { documentRepository } from '../../storage/documentRepository';

export interface UploadFieldCandidate {
  inputElement: HTMLInputElement;
  label?: string;
  isPrimary: boolean;
  orderIndex: number;
}

export class DocumentAdapter {
  /**
   * Discovers candidate file upload inputs on the current IVAC page
   */
  public findUploadInputs(): HTMLInputElement[] {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    return inputs.filter(input => !input.disabled);
  }

  /**
   * Attempt to attach a stored Blob to a standard HTML file input using DataTransfer
   */
  public async attachFileToInput(
    input: HTMLInputElement,
    fileBlob: Blob,
    fileName: string
  ): Promise<boolean> {
    try {
      const file = new File([fileBlob], fileName, { type: fileBlob.type || 'application/pdf' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;

      // Dispatch change and input events
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));

      return true;
    } catch (err) {
      console.warn('Programmatic file assignment restricted or failed:', err);
      return false;
    }
  }

  /**
   * Checks if an upload input has a visible confirmation (e.g. file name displayed or success alert)
   */
  public verifyUploadConfirmation(input: HTMLInputElement, fileName: string): boolean {
    if (input.files && input.files.length > 0 && input.files[0].name === fileName) {
      return true;
    }

    // Check parent container for rendered file name
    const parent = input.closest('form, .upload-container, .dropzone, div') || input.parentElement;
    if (parent && parent.textContent && parent.textContent.includes(fileName)) {
      return true;
    }

    return false;
  }

  /**
   * Orchestrates the document upload for a list of documents in strict sequence:
   * Primary (order 0) first, then additionals (1, 2, 3) in order.
   */
  public async uploadDocumentsSequentially(
    documents: DocumentMetadata[],
    onProgress: (docId: string, status: 'uploading' | 'uploaded' | 'error', message: string) => void
  ): Promise<{ success: boolean; uploadedCount: number; errorMessage?: string }> {
    const sortedDocs = [...documents].sort((a, b) => a.orderIndex - b.orderIndex);
    const availableInputs = this.findUploadInputs();

    if (availableInputs.length === 0) {
      return {
        success: false,
        uploadedCount: 0,
        errorMessage: 'No file upload fields detected on this page. Please navigate to the document upload step.'
      };
    }

    let successCount = 0;

    for (let i = 0; i < sortedDocs.length; i++) {
      const doc = sortedDocs[i];
      const docLabel = doc.role === 'primary' ? `Primary PDF (${doc.fileName})` : `Additional PDF #${doc.orderIndex} (${doc.fileName})`;
      onProgress(doc.id, 'uploading', `Processing ${docLabel} [${i + 1}/${sortedDocs.length}]...`);

      // 1. Strict mapping: Each document must map to its specific corresponding field index
      const targetInput = availableInputs[i];
      if (!targetInput) {
        const errorMsg = `No upload input field found for ${docLabel}. Page provides ${availableInputs.length} upload field(s). Workflow stopped.`;
        onProgress(doc.id, 'error', errorMsg);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: errorMsg
        };
      }

      // 2. Read stored PDF binary
      const binaryBlob = await documentRepository.getDocumentBinary(doc.id);
      if (!binaryBlob) {
        const errorMsg = `Missing binary data in storage for ${docLabel}. Workflow stopped.`;
        onProgress(doc.id, 'error', errorMsg);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: errorMsg
        };
      }

      // 3. Attach file to the designated target input
      const attached = await this.attachFileToInput(targetInput, binaryBlob, doc.fileName);
      if (!attached) {
        const errorMsg = `Browser prevented automatic upload of ${docLabel}. Manual upload required.`;
        onProgress(doc.id, 'error', errorMsg);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: errorMsg
        };
      }

      // Brief delay for website DOM reaction
      await new Promise(r => setTimeout(r, 600));

      // 4. Strict verification of successful upload
      const confirmed = this.verifyUploadConfirmation(targetInput, doc.fileName);
      if (confirmed) {
        successCount++;
        onProgress(doc.id, 'uploaded', `Successfully attached and verified ${docLabel}`);
      } else {
        const errorMsg = `Upload verification failed for ${docLabel}. Page did not confirm attachment. Workflow stopped.`;
        onProgress(doc.id, 'error', errorMsg);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: errorMsg
        };
      }
    }

    return {
      success: true,
      uploadedCount: successCount
    };
  }
}

export const documentAdapter = new DocumentAdapter();
