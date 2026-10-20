import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowEngine } from '../features/workflow/workflowEngine';
import { documentAdapter } from '../content/adapters/documentAdapter';
import { loginAdapter } from '../content/adapters/loginAdapter';
import { documentRepository } from '../storage/documentRepository';
import { credentialManager } from '../features/security/credentialManager';
import { IvacProfile } from '../types/profile';
import { DocumentMetadata } from '../types/document';

describe('Document Upload and Confirmation Workflow Verification', () => {
  let engine: WorkflowEngine;

  const testProfile: IvacProfile = {
    id: 'prof_doc_confirm_test',
    displayName: 'MD ABRAR HASAN TAASIN',
    applicantName: 'MD ABRAR HASAN TAASIN',
    mobileNumber: '01712345678',
    preferredCentre: 'Dhaka',
    encryptedPassword: 'mockPasswordHash',
    passwordSalt: 'mockSalt',
    passwordIv: 'mockIv',
    primaryDocumentId: 'doc_primary',
    additionalDocumentIds: ['doc_add_masum'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const primaryDoc: DocumentMetadata = {
    id: 'doc_primary',
    profileId: testProfile.id,
    fileName: 'MD_ABRAR_WEBFILE.pdf',
    fileSize: 320 * 1024, // 320KB (< 500KB)
    mimeType: 'application/pdf',
    role: 'primary',
    orderIndex: 0,
    uploadedAt: Date.now(),
    status: 'ready'
  };

  const additionalDoc: DocumentMetadata = {
    id: 'doc_add_masum',
    profileId: testProfile.id,
    fileName: 'MD_MASUM_ALAM_WEBFILE.pdf',
    fileSize: 450 * 1024, // 450KB (< 500KB)
    mimeType: 'application/pdf',
    role: 'additional',
    orderIndex: 1,
    uploadedAt: Date.now(),
    status: 'ready'
  };

  beforeEach(() => {
    document.documentElement.innerHTML = '<html><head></head><body></body></html>';
    window.history.replaceState({}, '', '/');
    credentialManager.lockAll();
    credentialManager.setUnlockedPassword(testProfile.id, 'SecretPass123!');
    engine = new WorkflowEngine();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    engine.stop();
  });

  describe('A. Login Form & Cloudflare Turnstile Verification', () => {
    it('uses form.space-y-5 and verifies inputs before filling', () => {
      document.body.innerHTML = `
        <form class="space-y-5">
          <input name="phone" type="tel" value="" />
          <input name="password" type="password" value="" />
          <div id="cf-turnstile"></div>
          <button type="submit" disabled>Login</button>
        </form>
      `;

      const res = loginAdapter.fillCredentials('01712345678', 'SecretPass123!');
      expect(res.success).toBe(true);

      const phoneInput = document.querySelector<HTMLInputElement>('input[name="phone"]')!;
      const passInput = document.querySelector<HTMLInputElement>('input[name="password"]')!;
      expect(phoneInput.value).toBe('01712345678');
      expect(passInput.value).toBe('SecretPass123!');

      // Turnstile is detected, manual verification required
      const turnstile = loginAdapter.detectTurnstile();
      expect(turnstile.present).toBe(true);
      expect(turnstile.isSolved).toBe(false);
    });

    it('does NOT force-enable a disabled submit button and refuses submission when disabled', () => {
      document.body.innerHTML = `
        <form class="space-y-5">
          <input name="phone" value="01712345678" />
          <input name="password" value="SecretPass123!" />
          <button type="submit" disabled>Login</button>
        </form>
      `;

      expect(loginAdapter.isSubmitButtonEnabled()).toBe(false);
      const submitRes = loginAdapter.submitLoginForm();
      expect(submitRes.success).toBe(false);
      expect(submitRes.isBlocked).toBe(true);
      expect(submitRes.message).toContain('currently disabled');
    });

    it('submits official login form once button becomes enabled after Turnstile verification', () => {
      document.body.innerHTML = `
        <form class="space-y-5">
          <input name="phone" value="01712345678" />
          <input name="password" value="SecretPass123!" />
          <button type="submit" id="btn-sub">Login</button>
        </form>
      `;

      const btn = document.getElementById('btn-sub') as HTMLButtonElement;
      let submitted = false;
      btn.addEventListener('click', () => {
        submitted = true;
      });

      expect(loginAdapter.isSubmitButtonEnabled()).toBe(true);
      const submitRes = loginAdapter.submitLoginForm();
      expect(submitRes.success).toBe(true);
      expect(submitted).toBe(true);
    });

    it('automatically triggers sign in submission without manual permission when credentials are ready', async () => {
      vi.useFakeTimers();
      document.body.innerHTML = `
        <form class="space-y-5">
          <input name="phone" value="" />
          <input name="password" value="" />
          <button type="submit" id="btn-auto-login">Sign In</button>
        </form>
      `;

      let autoClicked = false;
      document.getElementById('btn-auto-login')!.addEventListener('click', () => {
        autoClicked = true;
      });

      await engine.start(testProfile);
      engine.setDetectedPage('LOGIN');

      await vi.advanceTimersByTimeAsync(350);

      expect(autoClicked).toBe(true);
      expect(engine.getSession().state).toBe('AUTHENTICATION_PENDING');
      vi.useRealTimers();
    });
  });

  describe('C. Document Upload Validation & Mapping', () => {
    it('strictly rejects files exceeding the portal 500KB limit', () => {
      const oversizedDoc = {
        fileName: 'huge_passport.pdf',
        fileSize: 501 * 1024, // 501KB
        mimeType: 'application/pdf'
      };

      const validation = documentAdapter.validateDocument(oversizedDoc);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('exceeds the portal maximum allowed size of 500KB');
    });

    it('strictly rejects non-PDF files', () => {
      const imageDoc = {
        fileName: 'scanned_doc.jpg',
        fileSize: 200 * 1024,
        mimeType: 'image/jpeg'
      };

      const validation = documentAdapter.validateDocument(imageDoc);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Only PDF files are accepted');
    });

    it('accepts valid PDF files under 500KB', () => {
      const validDoc = {
        fileName: 'applicant_webfile.pdf',
        fileSize: 480 * 1024,
        mimeType: 'application/pdf'
      };

      const validation = documentAdapter.validateDocument(validDoc);
      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('finds and expands collapsed applicant cards before file assignment', async () => {
      document.body.innerHTML = `
        <div class="applicant-card rounded-xl border p-4">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs">Applicant 02</span>
              <h4>MD MASUM ALAM</h4>
            </div>
            <button class="chevron" aria-expanded="false">Expand</button>
          </div>
          <div class="upload-zone" style="display: none;">
            <label>Upload Other Applicant's Webfile</label>
            <input type="file" accept=".pdf,application/pdf" />
          </div>
        </div>
      `;

      const chevronBtn = document.querySelector<HTMLButtonElement>('.chevron')!;
      chevronBtn.addEventListener('click', () => {
        chevronBtn.setAttribute('aria-expanded', 'true');
        document.querySelector<HTMLElement>('.upload-zone')!.style.display = 'block';
      });

      const cards = documentAdapter.findApplicantCards();
      expect(cards.length).toBe(1);
      expect(cards[0].role).toBe('additional');
      expect(cards[0].index).toBe(1);

      const expanded = await documentAdapter.expandApplicantCard(cards[0]);
      expect(expanded).toBe(true);
      expect(chevronBtn.getAttribute('aria-expanded')).toBe('true');
    });

    it('maps primary PDF to primary field and additional PDF to additional field without mixing', () => {
      document.body.innerHTML = `
        <div class="applicant-section-1">
          <label>Upload Primary Applicant's Webfile</label>
          <input type="file" id="primary-file-input" accept=".pdf,application/pdf" />
        </div>
        <div class="applicant-section-2">
          <label>Upload Other Applicant's Webfile</label>
          <input type="file" id="additional-file-input" accept=".pdf,application/pdf" />
        </div>
      `;

      const primaryInput = documentAdapter.findApplicantUploadInput('primary', 0);
      expect(primaryInput).not.toBeNull();
      expect(primaryInput?.id).toBe('primary-file-input');

      const additionalInput = documentAdapter.findApplicantUploadInput('additional', 1);
      expect(additionalInput).not.toBeNull();
      expect(additionalInput?.id).toBe('additional-file-input');
    });
  });

  describe('D. "Confirm All Information is Correct" Button & Verification', () => {
    it('detects button by accessible text and reports disabled state correctly', () => {
      document.body.innerHTML = `
        <div>
          <button type="button" disabled>Confirm All Information is Correct</button>
        </div>
      `;

      const btn = documentAdapter.findConfirmAllButton();
      expect(btn).not.toBeNull();
      expect(documentAdapter.isConfirmAllButtonEnabled()).toBe(false);

      const clickRes = documentAdapter.clickConfirmAllButton();
      expect(clickRes.success).toBe(false);
      expect(clickRes.isBlocked).toBe(true);
      expect(clickRes.message).toContain('currently disabled');
    });

    it('clicks "Confirm All Information is Correct" only when enabled', () => {
      document.body.innerHTML = `
        <div>
          <button type="button" id="confirm-btn">Confirm All Information is Correct</button>
        </div>
      `;

      const btn = document.getElementById('confirm-btn') as HTMLButtonElement;
      let clicked = false;
      btn.addEventListener('click', () => {
        clicked = true;
      });

      expect(documentAdapter.isConfirmAllButtonEnabled()).toBe(true);
      const clickRes = documentAdapter.clickConfirmAllButton();
      expect(clickRes.success).toBe(true);
      expect(clicked).toBe(true);
    });
  });

  describe('E. Confirmation Modal: "Save & Continue"', () => {
    it('detects visible confirmation modal with expected heading and description', () => {
      document.body.innerHTML = `
        <div role="dialog" class="fixed inset-0 z-50">
          <div class="modal-card">
            <h2>Please Confirm Your Details</h2>
            <p>Make Sure All The Information Is Correct Before Saving And Continuing.</p>
            <button type="button" class="btn-orange">Save & Continue</button>
            <button type="button" class="btn-link">Go Back</button>
          </div>
        </div>
      `;

      const modal = documentAdapter.findConfirmationModal();
      expect(modal).not.toBeNull();
      expect(modal?.headingText).toContain('Please Confirm Your Details');
      expect(modal?.descriptionText).toContain('Make Sure All The Information Is Correct');
      expect(modal?.saveAndContinueButton.textContent).toContain('Save & Continue');
      expect(modal?.goBackButton?.textContent).toContain('Go Back');
      expect(documentAdapter.isSaveAndContinueButtonEnabled()).toBe(true);
    });

    it('clicks "Save & Continue" exactly once when explicitly confirmed by user', () => {
      document.body.innerHTML = `
        <div role="dialog" class="fixed inset-0 z-50">
          <h2>Please Confirm Your Details</h2>
          <button type="button" id="save-btn">Save & Continue</button>
        </div>
      `;

      const btn = document.getElementById('save-btn') as HTMLButtonElement;
      let clickCount = 0;
      btn.addEventListener('click', () => {
        clickCount++;
      });

      const res = documentAdapter.clickSaveAndContinue();
      expect(res.success).toBe(true);
      expect(clickCount).toBe(1);
    });
  });

  describe('F. End-to-End Workflow Transitions up to POST_CONFIRMATION', () => {
    it('transitions through DOCUMENT_UPLOAD -> WAITING_FOR_DOCUMENT_CONFIRMATION -> DETAILS_CONFIRMATION_MODAL -> POST_CONFIRMATION and STOPS', async () => {
      vi.useFakeTimers();

      // Setup DOM with document upload page and 2 applicant cards
      window.history.replaceState({}, '', '/document-upload');
      document.body.innerHTML = `
        <div class="upload-container">
          <div class="card">
            <span>Primary Applicant</span>
            <input type="file" id="in-1" />
          </div>
          <div class="card">
            <span>Applicant 02</span>
            <input type="file" id="in-2" />
          </div>
          <button type="button" id="confirm-all-btn">Confirm All Information is Correct</button>
        </div>
      `;

      vi.spyOn(documentRepository, 'getDocumentsByProfileId').mockResolvedValue([primaryDoc, additionalDoc]);
      vi.spyOn(documentRepository, 'getDocumentBinary').mockResolvedValue(new Blob(['dummy pdf'], { type: 'application/pdf' }));
      vi.spyOn(documentAdapter, 'attachFileToInput').mockResolvedValue(true);
      vi.spyOn(documentAdapter, 'verifyUploadConfirmation').mockReturnValue(true);

      // Start engine on document upload page
      await engine.start(testProfile);
      engine.setDetectedPage('DOCUMENT_UPLOAD');

      // 1. Documents uploaded and verified
      await vi.advanceTimersByTimeAsync(2500);
      expect(engine.getSession().state).toBe('WAITING_FOR_DOCUMENT_CONFIRMATION');

      // 2. User confirms document information in extension
      const confirmAllBtn = document.getElementById('confirm-all-btn')!;
      confirmAllBtn.addEventListener('click', () => {
        // Portal opens confirmation modal
        const modalDiv = document.createElement('div');
        modalDiv.setAttribute('role', 'dialog');
        modalDiv.innerHTML = `
          <h2>Please Confirm Your Details</h2>
          <p>Make Sure All The Information Is Correct Before Saving And Continuing.</p>
          <button type="button" id="modal-save-btn">Save & Continue</button>
        `;
        document.body.appendChild(modalDiv);
      });

      const confirmPromise = engine.confirmDocumentInformation();
      await vi.advanceTimersByTimeAsync(1000);
      const confirmRes = await confirmPromise;

      expect(confirmRes.success).toBe(true);
      expect(engine.getSession().state).toBe('DETAILS_CONFIRMATION_MODAL');
      expect(engine.getSession().confirmationDetails?.isModalVisible).toBe(true);

      // 3. User verifies details in assistant and clicks "Save & Continue"
      const modalSaveBtn = document.getElementById('modal-save-btn')!;
      modalSaveBtn.addEventListener('click', () => {
        // Portal closes modal and navigates to route
        document.querySelector('[role="dialog"]')?.remove();
      });

      const savePromise = engine.saveAndContinueConfirmation();
      await vi.advanceTimersByTimeAsync(1000);
      const saveRes = await savePromise;

      expect(saveRes.success).toBe(true);
      // Confirmed that state halts at POST_CONFIRMATION and does NOT start slot or payment automation!
      expect(engine.getSession().state).toBe('POST_CONFIRMATION');

      vi.useRealTimers();
    });
  });
});
