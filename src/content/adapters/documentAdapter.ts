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
      onProgress(doc.id, 'uploading', `Preparing document ${i + 1}/${sortedDocs.length}: ${doc.fileName}...`);

      const binaryBlob = await documentRepository.getDocumentBinary(doc.id);
      if (!binaryBlob) {
        onProgress(doc.id, 'error', `Could not read document data for ${doc.fileName}`);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: `Missing binary data for ${doc.fileName}`
        };
      }

      // Assign to the i-th input field, or available input
      const targetInput = availableInputs[i] || availableInputs[0];
      const attached = await this.attachFileToInput(targetInput, binaryBlob, doc.fileName);

      if (!attached) {
        onProgress(doc.id, 'error', `Browser prevented automatic upload of ${doc.fileName}. Please select it manually.`);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: `Manual selection required for ${doc.fileName}`
        };
      }

      // Wait brief moment for DOM update
      await new Promise(r => setTimeout(r, 600));

      const confirmed = this.verifyUploadConfirmation(targetInput, doc.fileName);
      if (confirmed) {
        successCount++;
        onProgress(doc.id, 'uploaded', `Successfully attached ${doc.fileName}`);
      } else {
        // If not strictly confirmed by DOM but files property set, count as attached
        if (targetInput.files && targetInput.files.length > 0) {
          successCount++;
          onProgress(doc.id, 'uploaded', `Attached ${doc.fileName}`);
        } else {
          onProgress(doc.id, 'error', `Could not verify upload of ${doc.fileName}`);
          return {
            success: false,
            uploadedCount: successCount,
            errorMessage: `Verification failed for ${doc.fileName}`
          };
        }
      }
    }

    return {
      success: true,
      uploadedCount: successCount
    };
  }
}

export const documentAdapter = new DocumentAdapter();
