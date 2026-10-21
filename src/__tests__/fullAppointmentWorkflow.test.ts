import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowEngine } from '../features/workflow/workflowEngine';
import { documentAdapter } from '../content/adapters/documentAdapter';
import { centreAdapter } from '../content/adapters/centreAdapter';
import { appointmentAdapter } from '../content/adapters/appointmentAdapter';
import { loginAdapter } from '../content/adapters/loginAdapter';
import { documentRepository } from '../storage/documentRepository';
import { credentialManager } from '../features/security/credentialManager';
import { IvacProfile } from '../types/profile';
import { DocumentMetadata } from '../types/document';

describe('Full Automated End-to-End Appointment Flow', () => {
  let engine: WorkflowEngine;

  const testProfile: IvacProfile = {
    id: 'prof_full_flow_rajshahi',
    displayName: 'Md Juyel Rana',
    applicantName: 'Md Juyel Rana',
    mobileNumber: '01712345678',
    preferredCentre: 'Rajshahi',
    encryptedPassword: 'mockPasswordHash',
    passwordSalt: 'mockSalt',
    passwordIv: 'mockIv',
    primaryDocumentId: 'doc_primary',
    additionalDocumentIds: ['doc_additional_1'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const primaryDoc: DocumentMetadata = {
    id: 'doc_primary',
    profileId: testProfile.id,
    fileName: 'PRIMARY_WEBFILE.pdf',
    fileSize: 250 * 1024,
    mimeType: 'application/pdf',
    role: 'primary',
    orderIndex: 0,
    uploadedAt: Date.now(),
    status: 'ready'
  };

  const additionalDoc: DocumentMetadata = {
    id: 'doc_additional_1',
    profileId: testProfile.id,
    fileName: 'ADDITIONAL_WEBFILE.pdf',
    fileSize: 300 * 1024,
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

  it('Step 1: dismisses modal popups (To book your visa appointment) and navigates to /appointment/file-upload', async () => {
    // Render the intro modal that appears after login
    document.body.innerHTML = `
      <div class="bg-white rounded-3xl shadow-lg flex flex-col p-6 w-full">
        <h2 class="text-2xl font-bold">To book your visa appointment</h2>
        <button id="next-step-btn" class="bg-[#FF671F]">
          <span>Next Step</span>
        </button>
      </div>
    `;

    let nextStepClicked = false;
    document.getElementById('next-step-btn')?.addEventListener('click', () => {
      nextStepClicked = true;
    });

    const navRes = loginAdapter.navigateToDocumentUpload();
    expect(navRes.success).toBe(true);
    expect(nextStepClicked).toBe(true);
  });

  it('Step 2: on /appointment/file-upload, uploads primary file first then additionals, and auto-clicks Confirm', async () => {
    vi.useFakeTimers();

    window.history.replaceState({}, '', '/appointment/file-upload');
    document.body.innerHTML = `
      <div class="upload-container">
        <div class="applicant-section-1">
          <label>Upload Primary Applicant's Webfile</label>
          <input type="file" id="primary-input" accept=".pdf,application/pdf" />
        </div>
        <div class="applicant-section-2">
          <label>Upload Other Applicant's Webfile</label>
          <input type="file" id="additional-input" accept=".pdf,application/pdf" />
        </div>
        <button type="button" id="confirm-btn">Confirm All Information is Correct</button>
      </div>
    `;

    vi.spyOn(documentRepository, 'getDocumentsByProfileId').mockResolvedValue([primaryDoc, additionalDoc]);
    vi.spyOn(documentRepository, 'getDocumentBinary').mockResolvedValue(new Blob(['pdf content'], { type: 'application/pdf' }));
    vi.spyOn(documentAdapter, 'attachFileToInput').mockResolvedValue(true);
    vi.spyOn(documentAdapter, 'verifyUploadConfirmation').mockReturnValue(true);

    let confirmClicked = false;
    document.getElementById('confirm-btn')?.addEventListener('click', () => {
      confirmClicked = true;
      // Portal opens confirmation dialog
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = `
        <h2>Please confirm your details</h2>
        <button type="button" id="save-continue-btn">Save & Continue</button>
      `;
      document.body.appendChild(modal);
    });

    await engine.start(testProfile);
    engine.setDetectedPage('DOCUMENT_UPLOAD');

    // Wait for uploads and auto-confirmation pipeline to complete
    await vi.advanceTimersByTimeAsync(3000);
    expect(confirmClicked).toBe(true);
    expect(['WAITING_FOR_DOCUMENT_CONFIRMATION', 'SAVE_AND_CONTINUE_PENDING', 'DETAILS_CONFIRMATION_MODAL', 'POST_CONFIRMATION']).toContain(engine.getSession().state);
  });

  it('Step 3: on /appointment/mission, selects preferred IVAC center (Rajshahi) from dropdown and clicks Confirm Mission & IVAC Center', async () => {
    vi.useFakeTimers();

    window.history.replaceState({}, '', '/appointment/mission');
    document.body.innerHTML = `
      <form class="space-y-6">
        <div>
          <button type="button" disabled>Select a mission</button>
        </div>
        <div class="w-full relative">
          <button type="button" id="center-trigger" class="w-full">
            <span>Select your IVAC center</span>
          </button>
          <div class="absolute z-50 w-full mt-2">
            <button type="button" id="opt-rajshahi" class="w-full">IVAC, RAJSHAHI</button>
          </div>
        </div>
        <button id="confirm-mission-btn" type="submit" class="bg-[#FF671F]">
          <span>Confirm Mission & IVAC Center</span>
        </button>
      </form>
    `;

    let centerSelected = false;
    let submitClicked = false;

    document.getElementById('opt-rajshahi')?.addEventListener('click', () => {
      centerSelected = true;
    });

    document.getElementById('confirm-mission-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      submitClicked = true;
    });

    await engine.start(testProfile);
    engine.setDetectedPage('CENTRE_SELECTION');

    await vi.advanceTimersByTimeAsync(800);
    expect(centerSelected).toBe(true);
    expect(submitClicked).toBe(true);
  });

  it('Step 4: on /appointment/time-slot, finds available date and selects it, ready for Continue Booking', async () => {
    vi.useFakeTimers();

    window.history.replaceState({}, '', '/appointment/time-slot');
    document.body.innerHTML = `
      <div class="calendar-card">
        <p>Select an Appointment Date</p>
        <p>Pick up a date</p>
        <div class="grid-cols-7">
          <button type="button" disabled class="cursor-not-allowed text-[#B0B0B0]">21</button>
          <button type="button" id="day-22" class="border border-[#004638] text-[#004638]">22</button>
          <button type="button" disabled class="cursor-not-allowed text-[#B0B0B0]">23</button>
        </div>
        <button id="continue-booking-btn" type="button" class="bg-[#FF671F]">
          <span>Continue Booking</span>
        </button>
      </div>
    `;

    let day22Clicked = false;
    let continueBookingClicked = false;

    const day22Btn = document.getElementById('day-22')!;
    day22Btn.addEventListener('click', () => {
      day22Clicked = true;
      day22Btn.classList.add('bg-[#FF671F]', 'text-white');
    });

    document.getElementById('continue-booking-btn')?.addEventListener('click', () => {
      continueBookingClicked = true;
    });

    await engine.start(testProfile);
    engine.setDetectedPage('APPOINTMENT_CALENDAR');

    await vi.advanceTimersByTimeAsync(1000);
    expect(day22Clicked).toBe(true);
    expect(continueBookingClicked).toBe(true);
  });

  it('Step 5: auto-fills exact selected IVAC centre (e.g. IVAC, Dhaka (JFP)) on /appointment/mission', async () => {
    vi.useFakeTimers();

    const dhakaProfile: IvacProfile = {
      ...testProfile,
      id: 'prof_dhaka_jfp',
      preferredCentre: 'IVAC, Dhaka (JFP)'
    };
    credentialManager.setUnlockedPassword(dhakaProfile.id, 'SecretPass123!');

    window.history.replaceState({}, '', '/appointment/mission');
    document.body.innerHTML = `
      <form class="space-y-6">
        <div>
          <button type="button" disabled>
            <span>Select a mission</span>
            <span class="text-lg">Dhaka</span>
          </button>
        </div>
        <div class="w-full relative">
          <button type="button" id="center-trigger" class="w-full">
            <span>Select your IVAC center</span>
          </button>
          <div class="absolute z-50 w-full mt-2">
            <button type="button" id="opt-dhaka" class="w-full">IVAC, DHAKA (JFP)</button>
            <button type="button" id="opt-other" class="w-full">IVAC, CHITTAGONG</button>
          </div>
        </div>
        <button id="confirm-mission-btn" type="submit" class="bg-[#FF671F]">
          <span>Confirm Mission & IVAC Center</span>
        </button>
      </form>
    `;

    let dhakaClicked = false;
    document.getElementById('opt-dhaka')?.addEventListener('click', () => {
      dhakaClicked = true;
    });

    // Test session detection helper
    const sessionData = centreAdapter.detectSessionCentres();
    expect(sessionData.mission).toBe('Dhaka');
    expect(sessionData.centres).toContain('IVAC, DHAKA (JFP)');

    await engine.start(dhakaProfile);
    engine.setDetectedPage('CENTRE_SELECTION');

    await vi.advanceTimersByTimeAsync(800);
    expect(dhakaClicked).toBe(true);
  });
});

