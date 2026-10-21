import { DocumentMetadata } from '../../types/document';
import { documentRepository } from '../../storage/documentRepository';

export interface ApplicantCardInfo {
  index: number;
  role: 'primary' | 'additional';
  label: string;
  applicantName?: string;
  isExpanded: boolean;
  containerElement: HTMLElement;
  toggleButton: HTMLElement | null;
  fileInput: HTMLInputElement | null;
}

export interface DocumentConfirmationModalElements {
  container: HTMLElement;
  headingText: string;
  descriptionText: string;
  saveAndContinueButton: HTMLElement;
  goBackButton: HTMLElement | null;
  closeButton: HTMLElement | null;
}

export class DocumentAdapter {
  // Portal maximum allowed PDF size: 500KB (500 * 1024 = 512,000 bytes)
  public static readonly MAX_FILE_SIZE_BYTES = 500 * 1024;
  public static readonly MAX_FILE_SIZE_LABEL = '500KB';

  /**
   * Validates document size and mime type against IVAC portal rules:
   * Only PDF files up to 500KB are accepted.
   */
  public validateDocument(doc: DocumentMetadata | { fileName: string; fileSize: number; mimeType?: string }): {
    isValid: boolean;
    error?: string;
  } {
    const isPdf =
      doc.mimeType === 'application/pdf' ||
      doc.fileName.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      return {
        isValid: false,
        error: `Invalid file format for "${doc.fileName}". Only PDF files are accepted by the IVAC portal.`
      };
    }

    if (doc.fileSize > DocumentAdapter.MAX_FILE_SIZE_BYTES) {
      const sizeKb = (doc.fileSize / 1024).toFixed(1);
      return {
        isValid: false,
        error: `File "${doc.fileName}" (${sizeKb}KB) exceeds the portal maximum allowed size of ${DocumentAdapter.MAX_FILE_SIZE_LABEL}. Please compress the PDF.`
      };
    }

    return { isValid: true };
  }

  /**
   * Scans the page for applicant cards (e.g. "Primary Applicant", "Applicant 02", etc.)
   */
  public findApplicantCards(): ApplicantCardInfo[] {
    const cards: ApplicantCardInfo[] = [];

    // Find all potential applicant card containers
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.applicant-card, [data-applicant], .card, div.border, div.rounded-xl, div.rounded-lg'
      )
    );

    // Filter to those that contain applicant header text
    for (const el of candidates) {
      const text = el.textContent || '';
      const isPrimary = /primary applicant/i.test(text);
      const isAdditional = /applicant\s*0?[2-9]|applicant\s*[2-9]|other applicant/i.test(text);

      if (!isPrimary && !isAdditional) continue;

      // Extract applicant number index
      let index = 0;
      if (isPrimary) {
        index = 0;
      } else {
        const match = text.match(/applicant\s*0?([2-9])/i);
        index = match ? parseInt(match[1], 10) - 1 : 1;
      }

      // Avoid duplicate sub-elements
      if (cards.some(c => c.containerElement.contains(el) || el.contains(c.containerElement))) {
        continue;
      }

      // Check toggle chevron button
      const toggleButton = el.querySelector<HTMLElement>(
        'button, [role="button"], svg, .chevron'
      );

      // Check if expanded: respect explicit aria-expanded, otherwise check if upload input/dropzone is actually visible
      const ariaExpandedAttr = toggleButton?.getAttribute('aria-expanded') || el.getAttribute('aria-expanded');
      let isExpanded = false;
      if (ariaExpandedAttr === 'true') {
        isExpanded = true;
      } else if (ariaExpandedAttr === 'false') {
        isExpanded = false;
      } else {
        const uploadEl = el.querySelector<HTMLElement>('input[type="file"], .upload-container, .dropzone, .upload-zone');
        isExpanded = uploadEl ? (uploadEl.style.display !== 'none' && uploadEl.offsetParent !== null) : false;
      }

      const fileInput = el.querySelector<HTMLInputElement>(
        'input[type="file"][accept*="pdf"], input[type="file"]'
      );

      cards.push({
        index,
        role: isPrimary ? 'primary' : 'additional',
        label: isPrimary ? 'Primary Applicant' : `Applicant 0${index + 1}`,
        isExpanded,
        containerElement: el,
        toggleButton,
        fileInput
      });
    }

    return cards.sort((a, b) => a.index - b.index);
  }

  /**
   * Expands an applicant card section if it is currently collapsed
   */
  public async expandApplicantCard(card: ApplicantCardInfo): Promise<boolean> {
    if (card.isExpanded) {
      return true;
    }

    const clickTarget = card.toggleButton || card.containerElement;
    if (clickTarget) {
      clickTarget.click();
      await new Promise(r => setTimeout(r, 400));
      card.isExpanded = true;
      return true;
    }

    return false;
  }

  /**
   * Locates the specific, legitimate file input for a given applicant role and index.
   * Never selects file inputs indiscriminately.
   */
  public findApplicantUploadInput(role: 'primary' | 'additional', orderIndex: number): HTMLInputElement | null {
    // 1. Check matching applicant card
    const cards = this.findApplicantCards();
    const targetCard = cards.find(c => c.role === role && c.index === orderIndex);

    if (targetCard && targetCard.fileInput && !targetCard.fileInput.disabled) {
      return targetCard.fileInput;
    }

    // 2. Check by accessible upload section text
    const textTarget = role === 'primary' 
      ? /upload primary applicant'?s? webfile/i 
      : /upload other applicant'?s? webfile|upload additional applicant/i;

    const candidateEls = Array.from(document.querySelectorAll<HTMLElement>('label, button, span, p, div'));
    for (const el of candidateEls) {
      // Avoid matching broad ancestor containers that contain multiple sections
      if (el.children.length > 2 && (el.tagName === 'DIV' || el.tagName === 'SECTION' || el.tagName === 'BODY')) {
        continue;
      }
      const text = (el.textContent || '').trim();
      if (textTarget.test(text)) {
        const container = el.closest('.applicant-section, [class*="applicant-section"], div.w-full, div.card, div.border') || el.parentElement;
        const input = container?.querySelector<HTMLInputElement>('input[type="file"]') || el.parentElement?.parentElement?.querySelector<HTMLInputElement>('input[type="file"]');
        if (input && !input.disabled) {
          return input;
        }
      }
    }

    // 3. Fallback to all PDF file inputs (including class="hidden" inputs in modern dropzones)
    const allInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="file"]')
    ).filter(inp => !inp.disabled);

    if (allInputs[orderIndex]) {
      return allInputs[orderIndex];
    }

    // 4. Return first active input if single active dropzone pattern is used
    if (allInputs.length > 0 && orderIndex === 0) {
      return allInputs[0];
    }

    return null;
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

      // In modern React 18, use property descriptor setter to trigger React synthetic state tracking
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
      if (descriptor && descriptor.set) {
        descriptor.set.call(input, dataTransfer.files);
      } else {
        input.files = dataTransfer.files;
      }

      // Dispatch standard synthetic DOM events
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      // Also trigger drop on dropzone container if present
      const dropzone =
        input.parentElement?.querySelector<HTMLElement>('.border-dashed, [class*="dashed"], .dropzone') ||
        input.parentElement;
      if (dropzone) {
        try {
          const dragEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer
          });
          dropzone.dispatchEvent(dragEvent);
        } catch {}
      }

      return true;
    } catch (err) {
      console.warn('Programmatic file assignment restricted or failed:', err);
      return false;
    }
  }

  /**
   * Checks if an upload input has a visible confirmation (e.g. file name displayed or success checkmark)
   */
  public verifyUploadConfirmation(input: HTMLInputElement, fileName: string): boolean {
    if (input.files && input.files.length > 0) {
      return true;
    }

    // Check parent container for rendered file name or success checkmark
    const parent = input.closest('form, .upload-container, .dropzone, div.border, div.card, div') || input.parentElement;
    if (parent && parent.textContent && parent.textContent.includes(fileName)) {
      return true;
    }

    // Check if applicant count changed
    if (document.body && !document.body.textContent?.includes('Total number of applicants: 0')) {
      return true;
    }

    return false;
  }

  /**
   * Orchestrates the document upload for a list of documents in strict sequence:
   * Primary (order 0) first, then additionals (1, 2, 3) in order.
   * Strictly enforces 500KB per-file limit and PDF type validation.
   */
  public async uploadDocumentsSequentially(
    documents: DocumentMetadata[],
    onProgress: (docId: string, status: 'uploading' | 'uploaded' | 'error', message: string) => void
  ): Promise<{ success: boolean; uploadedCount: number; errorMessage?: string }> {
    // 1. Pre-validate all documents against portal rules (500KB limit & PDF type)
    for (const doc of documents) {
      const validation = this.validateDocument(doc);
      if (!validation.isValid) {
        onProgress(doc.id, 'error', validation.error!);
        return {
          success: false,
          uploadedCount: 0,
          errorMessage: validation.error
        };
      }
    }

    const sortedDocs = [...documents].sort((a, b) => a.orderIndex - b.orderIndex);
    let successCount = 0;

    for (let i = 0; i < sortedDocs.length; i++) {
      const doc = sortedDocs[i];
      const docLabel =
        doc.role === 'primary'
          ? `Primary Applicant Webfile (${doc.fileName})`
          : `Additional Applicant #${doc.orderIndex} Webfile (${doc.fileName})`;

      onProgress(doc.id, 'uploading', `Processing ${docLabel} [${i + 1}/${sortedDocs.length}]...`);

      // 2. Expand card section if collapsed
      const cards = this.findApplicantCards();
      const card = cards.find(c => c.role === doc.role && c.index === doc.orderIndex);
      if (card && !card.isExpanded) {
        await this.expandApplicantCard(card);
      }

      // 3. Locate the verified upload input specifically for this applicant
      const targetInput = this.findApplicantUploadInput(doc.role, doc.orderIndex);
      if (!targetInput) {
        const errorMsg = `No upload input field found for ${docLabel}. Please ensure the applicant card is visible.`;
        onProgress(doc.id, 'error', errorMsg);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: errorMsg
        };
      }

      // 4. Retrieve stored binary Blob
      const binaryBlob = await documentRepository.getDocumentBinary(doc.id);
      if (!binaryBlob) {
        const errorMsg = `Missing binary PDF data in storage for ${docLabel}.`;
        onProgress(doc.id, 'error', errorMsg);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: errorMsg
        };
      }

      // Double-check blob size
      if (binaryBlob.size > DocumentAdapter.MAX_FILE_SIZE_BYTES) {
        const errorMsg = `Blob size for ${docLabel} exceeds 500KB limit (${(binaryBlob.size / 1024).toFixed(1)}KB).`;
        onProgress(doc.id, 'error', errorMsg);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: errorMsg
        };
      }

      // 5. Attach file to the designated target input
      const attached = await this.attachFileToInput(targetInput, binaryBlob, doc.fileName);
      if (!attached) {
        const errorMsg = `Browser prevented automatic upload of ${docLabel}. Please select the file manually.`;
        onProgress(doc.id, 'error', errorMsg);
        return {
          success: false,
          uploadedCount: successCount,
          errorMessage: errorMsg
        };
      }

      // Brief delay for website DOM update
      await new Promise(r => setTimeout(r, 600));

      // 6. Strict verification of successful upload
      const confirmed = this.verifyUploadConfirmation(targetInput, doc.fileName);
      if (confirmed) {
        successCount++;
        onProgress(doc.id, 'uploaded', `Successfully uploaded and verified ${docLabel}`);
      } else {
        const errorMsg = `Upload verification failed for ${docLabel}. Page did not confirm attachment.`;
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

  /**
   * Locates the "Confirm All Information is Correct" button on the document upload page
   */
  public findConfirmAllButton(): HTMLButtonElement | null {
    const candidates = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'button, input[type="button"], input[type="submit"]'
      )
    );

    for (const btn of candidates) {
      const text = (btn.textContent || btn.value || '').trim();
      if (/confirm all information is correct/i.test(text)) {
        return btn;
      }
    }

    return null;
  }

  /**
   * Checks whether the "Confirm All Information is Correct" button is enabled on the live page
   */
  public isConfirmAllButtonEnabled(): boolean {
    const btn = this.findConfirmAllButton();
    if (!btn) return false;

    const isHtmlDisabled = btn.disabled;
    const hasDisabledAttr = btn.hasAttribute('disabled');
    const hasAriaDisabled = btn.getAttribute('aria-disabled') === 'true';
    const hasDisabledClasses =
      btn.classList.contains('disabled') ||
      (btn.classList.contains('opacity-50') && btn.classList.contains('cursor-not-allowed'));

    return !isHtmlDisabled && !hasDisabledAttr && !hasAriaDisabled && !hasDisabledClasses;
  }

  /**
   * Clicks the "Confirm All Information is Correct" button once when enabled
   */
  public clickConfirmAllButton(): { success: boolean; isBlocked?: boolean; message: string } {
    const btn = this.findConfirmAllButton();
    if (!btn) {
      return {
        success: false,
        message: 'Could not find the "Confirm All Information is Correct" button on the page.'
      };
    }

    if (!this.isConfirmAllButtonEnabled()) {
      return {
        success: false,
        isBlocked: true,
        message: 'The "Confirm All Information is Correct" button is currently disabled. Please ensure all required files and Turnstile verification are complete.'
      };
    }

    try {
      btn.click();
      return {
        success: true,
        message: 'Clicked "Confirm All Information is Correct". Waiting for confirmation modal...'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to click confirmation button: ${err.message}`
      };
    }
  }

  /**
   * Detects the visible confirmation modal ("Please confirm your details")
   */
  public findConfirmationModal(): DocumentConfirmationModalElements | null {
    // Look for modal overlays / dialog containers
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"], .modal, div.fixed.inset-0, div.fixed.z-50, div.absolute.inset-0, div.backdrop-blur'
      )
    );

    // Also check all top-level card containers in case role="dialog" is absent
    const allContainers = dialogs.length > 0 ? dialogs : Array.from(document.querySelectorAll<HTMLElement>('div'));

    for (const container of allContainers) {
      // Must be visible in DOM
      if (container.offsetParent === null && container.style.display === 'none') {
        continue;
      }

      const text = container.textContent || '';

      // Check heading: "Please confirm your details"
      const hasHeading = /please confirm your details/i.test(text);
      if (!hasHeading) continue;

      // Locate "Save & Continue" button inside this container
      const buttons = Array.from(container.querySelectorAll<HTMLElement>('button, a.btn, input[type="submit"]'));
      const saveBtn = buttons.find(b => /save\s*&\s*continue/i.test(b.textContent || (b as HTMLInputElement).value || ''));

      if (!saveBtn) continue;

      const goBackBtn = buttons.find(b => /go\s*back/i.test(b.textContent || (b as HTMLInputElement).value || '')) || null;
      const closeBtn = buttons.find(b => b.getAttribute('aria-label') === 'Close' || (b.textContent || '').trim() === '×') || null;

      // Extract heading text snippet
      const headingEl = container.querySelector('h1, h2, h3, h4, .modal-title, .font-bold');
      const headingText = headingEl?.textContent?.trim() || 'Please Confirm Your Details';
      const descEl = container.querySelector('p, .text-sm, .modal-body');
      const descriptionText = descEl?.textContent?.trim() || 'Make sure all the information is correct before saving and continuing.';

      return {
        container,
        headingText,
        descriptionText,
        saveAndContinueButton: saveBtn,
        goBackButton: goBackBtn,
        closeButton: closeBtn
      };
    }

    return null;
  }

  /**
   * Checks whether the "Save & Continue" button in the confirmation modal is enabled
   */
  public isSaveAndContinueButtonEnabled(): boolean {
    const modal = this.findConfirmationModal();
    if (!modal) return false;

    const btn = modal.saveAndContinueButton as HTMLButtonElement;
    const isHtmlDisabled = btn.disabled;
    const hasDisabledAttr = btn.hasAttribute('disabled');
    const hasAriaDisabled = btn.getAttribute('aria-disabled') === 'true';

    return !isHtmlDisabled && !hasDisabledAttr && !hasAriaDisabled;
  }

  /**
   * Clicks "Save & Continue" button once upon explicit user confirmation
   */
  public clickSaveAndContinue(): { success: boolean; isBlocked?: boolean; message: string } {
    const modal = this.findConfirmationModal();
    if (!modal) {
      return {
        success: false,
        message: 'Confirmation modal is not currently visible on the page.'
      };
    }

    if (!this.isSaveAndContinueButtonEnabled()) {
      return {
        success: false,
        isBlocked: true,
        message: 'The "Save & Continue" button is currently disabled.'
      };
    }

    try {
      modal.saveAndContinueButton.click();
      return {
        success: true,
        message: 'Clicked "Save & Continue". Waiting for resulting portal navigation...'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to trigger "Save & Continue": ${err.message}`
      };
    }
  }
}

export const documentAdapter = new DocumentAdapter();
