import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appointmentAdapter } from '../content/adapters/appointmentAdapter';
import { documentAdapter } from '../content/adapters/documentAdapter';
import { loginAdapter } from '../content/adapters/loginAdapter';
import { PaymentAdapter } from '../content/adapters/paymentAdapter';
import { DocumentMetadata } from '../types/document';
import { documentRepository } from '../storage/documentRepository';

describe('Content Adapters Stabilization & Verification Tests', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<html><head></head><body></body></html>';
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  describe('AppointmentAdapter', () => {
    it('filters out disabled, booked, or full slot elements', () => {
      document.body.innerHTML = `
        <div class="calendar">
          <button class="slot-btn" disabled>09:00 AM (Disabled)</button>
          <button class="slot-btn booked">10:00 AM (Booked)</button>
          <button class="slot-btn unavailable">11:00 AM (Unavailable)</button>
          <button class="slot-btn" aria-disabled="true">12:00 PM</button>
          <button class="slot-btn" style="display: none;">01:00 PM (Hidden)</button>
          <button class="slot-btn" id="real-slot-1">02:00 PM</button>
          <button class="slot-btn" id="real-slot-2">03:00 PM</button>
        </div>
      `;

      const slots = appointmentAdapter.findSelectableSlots();
      expect(slots.length).toBe(2);
      expect(slots[0].id).toBe('real-slot-1');
      expect(slots[0].displayText).toBe('02:00 PM');
      expect(slots[1].id).toBe('real-slot-2');
    });

    it('does NOT claim success if selection state was not confirmed by the page', () => {
      document.body.innerHTML = `
        <div class="calendar">
          <button class="slot-btn" id="slot-unconfirmed">10:00 AM</button>
        </div>
      `;

      // Button is clicked, but does NOT gain .selected, .active, or aria-selected
      const res = appointmentAdapter.selectFirstAvailableSlot();
      expect(res.success).toBe(false);
      expect(res.message).toContain('selection confirmation was not detected');
    });

    it('claims success when the page confirms the slot selection with active/selected class', () => {
      document.body.innerHTML = `
        <div class="calendar">
          <button class="slot-btn" id="slot-confirmable">11:30 AM</button>
        </div>
      `;

      const btn = document.getElementById('slot-confirmable')!;
      btn.addEventListener('click', () => {
        btn.classList.add('selected');
      });

      const res = appointmentAdapter.selectFirstAvailableSlot();
      expect(res.success).toBe(true);
      expect(res.slotText).toBe('11:30 AM');
      expect(res.message).toContain('Confirmed slot selection');
    });

    it('returns graceful message when no slots are available', () => {
      document.body.innerHTML = '<div class="calendar"><p>No slots open.</p></div>';
      const res = appointmentAdapter.selectFirstAvailableSlot();
      expect(res.success).toBe(false);
      expect(res.message).toContain('No available appointment slots found');
    });
  });

  describe('DocumentAdapter', () => {
    it('processes primary document first, followed by additional documents in configured order', async () => {
      document.body.innerHTML = `
        <form>
          <input type="file" id="field-primary" />
          <input type="file" id="field-add-1" />
          <input type="file" id="field-add-2" />
        </form>
      `;

      const docs: DocumentMetadata[] = [
        {
          id: 'doc-add-2',
          profileId: 'prof_1',
          fileName: 'utility_bill.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          role: 'additional',
          orderIndex: 2,
          uploadedAt: Date.now(),
          status: 'ready'
        },
        {
          id: 'doc-primary',
          profileId: 'prof_1',
          fileName: 'passport_scan.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          role: 'primary',
          orderIndex: 0,
          uploadedAt: Date.now(),
          status: 'ready'
        },
        {
          id: 'doc-add-1',
          profileId: 'prof_1',
          fileName: 'bank_statement.pdf',
          fileSize: 1500,
          mimeType: 'application/pdf',
          role: 'additional',
          orderIndex: 1,
          uploadedAt: Date.now(),
          status: 'ready'
        }
      ];

      // Mock getDocumentBinary
      vi.spyOn(documentRepository, 'getDocumentBinary').mockResolvedValue(new Blob(['dummy pdf content'], { type: 'application/pdf' }));
      // Mock attachFileToInput to simulate successful attachment
      vi.spyOn(documentAdapter, 'attachFileToInput').mockResolvedValue(true);
      // Mock verifyUploadConfirmation to return true
      vi.spyOn(documentAdapter, 'verifyUploadConfirmation').mockReturnValue(true);

      const progressSteps: string[] = [];
      const res = await documentAdapter.uploadDocumentsSequentially(docs, (docId, status, _msg) => {
        progressSteps.push(`${docId}:${status}`);
      });

      expect(res.success).toBe(true);
      expect(res.uploadedCount).toBe(3);

      // Verify strict sequential processing: primary doc first, then doc-add-1, then doc-add-2
      const uploadedOrder = progressSteps.filter(s => s.endsWith(':uploaded'));
      expect(uploadedOrder).toEqual([
        'doc-primary:uploaded',
        'doc-add-1:uploaded',
        'doc-add-2:uploaded'
      ]);
    });

    it('stops workflow immediately when an upload input field is missing on the page', async () => {
      // Page only provides 1 file input, but 2 documents need upload
      document.body.innerHTML = `
        <form>
          <input type="file" id="field-primary-only" />
        </form>
      `;

      const docs: DocumentMetadata[] = [
        {
          id: 'doc-primary',
          profileId: 'prof_1',
          fileName: 'passport.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          role: 'primary',
          orderIndex: 0,
          uploadedAt: Date.now(),
          status: 'ready'
        },
        {
          id: 'doc-add-1',
          profileId: 'prof_1',
          fileName: 'visa_form.pdf',
          fileSize: 1500,
          mimeType: 'application/pdf',
          role: 'additional',
          orderIndex: 1,
          uploadedAt: Date.now(),
          status: 'ready'
        }
      ];

      vi.spyOn(documentRepository, 'getDocumentBinary').mockResolvedValue(new Blob(['dummy content']));
      vi.spyOn(documentAdapter, 'attachFileToInput').mockResolvedValue(true);
      vi.spyOn(documentAdapter, 'verifyUploadConfirmation').mockReturnValue(true);

      const res = await documentAdapter.uploadDocumentsSequentially(docs, () => {});

      expect(res.success).toBe(false);
      expect(res.uploadedCount).toBe(1); // Uploaded primary, but halted at doc 2
      expect(res.errorMessage).toContain('No upload input field found for Additional');
    });

    it('stops workflow immediately when document upload verification fails', async () => {
      document.body.innerHTML = `
        <form>
          <input type="file" id="field-1" />
        </form>
      `;

      const docs: DocumentMetadata[] = [
        {
          id: 'doc-primary',
          profileId: 'prof_1',
          fileName: 'passport.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          role: 'primary',
          orderIndex: 0,
          uploadedAt: Date.now(),
          status: 'ready'
        }
      ];

      vi.spyOn(documentRepository, 'getDocumentBinary').mockResolvedValue(new Blob(['dummy content']));
      vi.spyOn(documentAdapter, 'attachFileToInput').mockResolvedValue(true);
      // Simulate verification failure (e.g. rejection or failed event)
      vi.spyOn(documentAdapter, 'verifyUploadConfirmation').mockReturnValue(false);

      const res = await documentAdapter.uploadDocumentsSequentially(docs, () => {});

      expect(res.success).toBe(false);
      expect(res.uploadedCount).toBe(0);
      expect(res.errorMessage).toContain('Upload verification failed');
    });
  });

  describe('LoginAdapter', () => {
    it('populates mobile and password inputs and dispatches synthetic events', () => {
      document.body.innerHTML = `
        <form id="login">
          <input type="tel" name="phone" id="phone" />
          <input type="password" name="password" id="password" />
        </form>
      `;

      const mobileInput = document.getElementById('phone') as HTMLInputElement;
      const passInput = document.getElementById('password') as HTMLInputElement;

      let mobileInputFired = false;
      mobileInput.addEventListener('input', () => {
        mobileInputFired = true;
      });

      const res = loginAdapter.fillCredentials('01711223344', 'MySecretPass123');

      expect(res.success).toBe(true);
      expect(mobileInput.value).toBe('01711223344');
      expect(passInput.value).toBe('MySecretPass123');
      expect(mobileInputFired).toBe(true);
    });

    it('requires manual CAPTCHA solving when CAPTCHA element is present', () => {
      document.body.innerHTML = `
        <form id="login">
          <input type="tel" name="mobile" />
          <input type="password" name="password" />
          <div class="g-recaptcha" data-sitekey="dummy"></div>
        </form>
      `;

      const res = loginAdapter.fillCredentials('01711223344', 'Pass');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Please solve the CAPTCHA');
    });

    it('detectAuthSuccess returns false if active error alert is visible on page', () => {
      document.body.innerHTML = `
        <div class="alert-danger" role="alert">
          Invalid OTP or session expired.
        </div>
        <div class="user-profile">Profile</div>
      `;

      const isAuthed = loginAdapter.detectAuthSuccess();
      expect(isAuthed).toBe(false);
    });

    it('detectAuthSuccess returns true when post-auth elements are present without errors', () => {
      document.body.innerHTML = `
        <nav>
          <div class="logged-in-user">John Doe</div>
          <a href="/logout">Logout</a>
        </nav>
      `;

      const isAuthed = loginAdapter.detectAuthSuccess();
      expect(isAuthed).toBe(true);
    });
  });

  describe('PaymentAdapter', () => {
    it('provides clear handoff message and performs no automated interaction', () => {
      expect(PaymentAdapter.HANDOFF_MESSAGE).toContain('For your security, the assistant will NOT interact with payment systems');
      expect(PaymentAdapter.HANDOFF_MESSAGE).toContain('Please complete your fee payment manually');
    });
  });
});
