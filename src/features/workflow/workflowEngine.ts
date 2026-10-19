import { WorkflowState, IvacPageType, WorkflowSession, WorkflowLogEntry } from '../../types/workflow';
import { IvacProfile } from '../../types/profile';
import { documentRepository } from '../../storage/documentRepository';
import { credentialManager } from '../security/credentialManager';
import { loginAdapter } from '../../content/adapters/loginAdapter';
import { documentAdapter } from '../../content/adapters/documentAdapter';
import { centreAdapter } from '../../content/adapters/centreAdapter';
import { appointmentAdapter } from '../../content/adapters/appointmentAdapter';
import { PaymentAdapter } from '../../content/adapters/paymentAdapter';
import { validateOtpFormat } from '../../utils/validation';

export type WorkflowListener = (session: WorkflowSession) => void;

export class WorkflowEngine {
  private session: WorkflowSession = {
    state: 'IDLE',
    activeProfileId: null,
    detectedPage: 'UNKNOWN',
    currentDocumentIndex: 0,
    uploadedDocumentIds: [],
    errorMessage: null,
    isPaused: false,
    authStatus: 'idle',
    otpState: {
      isRequired: false,
      isSubmitting: false
    },
    logs: []
  };

  private listeners: Set<WorkflowListener> = new Set();
  private activeProfile: IvacProfile | null = null;
  private authCheckTimer: number | null = null;

  constructor() {
    this.addLog('info', 'IVAC Assistant Engine initialized.');
  }

  public getSession(): WorkflowSession {
    return { ...this.session };
  }

  public subscribe(listener: WorkflowListener): () => void {
    this.listeners.add(listener);
    listener(this.getSession());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const sessionSnapshot = this.getSession();
    this.listeners.forEach((listener) => listener(sessionSnapshot));
  }

  public addLog(type: WorkflowLogEntry['type'], message: string, page?: IvacPageType) {
    const entry: WorkflowLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type,
      message,
      page: page || this.session.detectedPage
    };

    this.session.logs = [entry, ...this.session.logs.slice(0, 49)];
    this.notify();
  }

  public setState(nextState: WorkflowState, errorMessage?: string) {
    if (this.session.state === nextState) return;

    this.session.previousState = this.session.state;
    this.session.state = nextState;
    if (errorMessage !== undefined) {
      this.session.errorMessage = errorMessage;
    }

    this.addLog('info', `Workflow state changed to: ${nextState}`);
    this.notify();
  }

  public setDetectedPage(page: IvacPageType) {
    if (this.session.detectedPage === page) return;

    this.session.detectedPage = page;
    this.addLog('info', `Detected IVAC Page: ${page}`, page);

    // If currently running, react to detected page
    if (!this.session.isPaused && this.session.state !== 'IDLE' && this.session.state !== 'STOPPED' && this.session.state !== 'ERROR') {
      this.handlePageTransition(page);
    }
  }

  /**
   * Primary entry point when user clicks "Start"
   */
  public async start(profile: IvacProfile): Promise<void> {
    if (this.session.state !== 'IDLE' && this.session.state !== 'STOPPED' && this.session.state !== 'ERROR' && this.session.state !== 'COMPLETED') {
      this.addLog('warning', 'Workflow is already active.');
      return;
    }

    // Verify profile documents readiness
    if (!profile.primaryDocumentId) {
      this.setState('ERROR', 'Primary applicant PDF document is required before starting.');
      this.addLog('error', 'Cannot start: Primary PDF document is missing.');
      return;
    }

    // Check credentials readiness
    const unlockedPassword = credentialManager.getUnlockedPassword(profile.id);
    if (!unlockedPassword) {
      this.setState('ERROR', 'Profile password is locked. Please enter your Master PIN to unlock credentials.');
      this.addLog('error', 'Cannot start: Profile password is locked. Master PIN required.');
      return;
    }

    this.activeProfile = profile;
    this.session.activeProfileId = profile.id;
    this.session.isPaused = false;
    this.session.errorMessage = null;
    this.session.uploadedDocumentIds = [];
    this.session.currentDocumentIndex = 0;
    this.session.authStatus = 'idle';
    this.session.otpState = { isRequired: false, isSubmitting: false };

    this.setState('PROFILE_SELECTED');
    this.addLog('info', `Starting assistant workflow for profile: "${profile.displayName}"`);

    // Determine starting state based on current page
    this.handlePageTransition(this.session.detectedPage);
  }

  public pause(reason?: string) {
    if (this.session.isPaused) return;

    this.session.isPaused = true;
    this.session.pausedReason = reason || 'User paused workflow';
    this.session.previousState = this.session.state;
    this.session.state = 'PAUSED';
    this.addLog('warning', `Workflow paused: ${this.session.pausedReason}`);
    this.notify();
  }

  public resume() {
    if (!this.session.isPaused) return;

    this.session.isPaused = false;
    this.session.pausedReason = undefined;
    const resumeToState = this.session.previousState || 'IDLE';
    this.session.state = resumeToState;
    this.addLog('info', `Workflow resumed in state: ${resumeToState}`);
    this.notify();

    // Re-evaluate on current page
    this.handlePageTransition(this.session.detectedPage);
  }

  public stop() {
    if (this.authCheckTimer) {
      window.clearTimeout(this.authCheckTimer);
      this.authCheckTimer = null;
    }
    this.session.isPaused = false;
    this.session.pausedReason = undefined;
    this.session.otpState = { isRequired: false, isSubmitting: false };
    this.session.authStatus = 'idle';
    this.setState('STOPPED');
    this.addLog('info', 'Workflow was stopped by user.');
  }

  public reset() {
    if (this.authCheckTimer) {
      window.clearTimeout(this.authCheckTimer);
      this.authCheckTimer = null;
    }
    this.session = {
      state: 'IDLE',
      activeProfileId: null,
      detectedPage: 'UNKNOWN',
      currentDocumentIndex: 0,
      uploadedDocumentIds: [],
      errorMessage: null,
      isPaused: false,
      authStatus: 'idle',
      otpState: {
        isRequired: false,
        isSubmitting: false
      },
      logs: []
    };
    this.activeProfile = null;
    this.addLog('info', 'Workflow reset to IDLE.');
  }

  /**
   * Reactive transitions triggered by page detector or stage completion
   */
  private async handlePageTransition(page: IvacPageType) {
    if (this.session.isPaused) return;
    if (!this.activeProfile) return;

    switch (page) {
      case 'LOGIN': {
        this.setState('LOGIN_READY');
        this.addLog('info', 'Executing profile login helper...');
        const password = credentialManager.getUnlockedPassword(this.activeProfile.id) || undefined;
        const loginRes = loginAdapter.fillCredentials(
          this.activeProfile.mobileNumber,
          password
        );

        if (loginRes.success) {
          this.setState('WAITING_FOR_USER_AUTHENTICATION');
          this.session.authStatus = 'awaiting_captcha';
          this.addLog('success', loginRes.message);
          this.addLog('warning', 'Please complete the CAPTCHA and submit the login form on the page.');
        } else {
          this.addLog('warning', loginRes.message);
        }
        break;
      }

      case 'OTP_VERIFICATION': {
        this.setState('WAITING_FOR_USER_AUTHENTICATION');
        this.session.authStatus = 'awaiting_otp';
        this.session.otpState = {
          isRequired: true,
          isSubmitting: false
        };
        this.addLog('info', 'OTP verification detected. Enter your SMS code in the assistant.');
        this.notify();
        break;
      }

      case 'DOCUMENT_UPLOAD':
        this.session.otpState.isRequired = false;
        this.session.authStatus = 'authenticated';
        this.setState('DOCUMENT_UPLOAD');
        await this.handleDocumentUploadStage();
        break;

      case 'CENTRE_SELECTION':
        this.session.otpState.isRequired = false;
        this.session.authStatus = 'authenticated';
        this.setState('CENTRE_SELECTION');
        this.handleCentreSelectionStage();
        break;

      case 'APPOINTMENT_CALENDAR':
        this.setState('APPOINTMENT_SELECTION');
        this.handleAppointmentStage();
        break;

      case 'PAYMENT':
        this.setState('PAYMENT_HANDOFF');
        this.addLog('warning', PaymentAdapter.HANDOFF_MESSAGE);
        break;

      default:
        // If we were awaiting auth and detected a non-login page with auth confirmation
        if (this.session.state === 'WAITING_FOR_USER_AUTHENTICATION' && loginAdapter.detectAuthSuccess()) {
          this.session.authStatus = 'authenticated';
          this.session.otpState.isRequired = false;
          this.addLog('success', 'User authentication confirmed by website.');
        } else {
          this.addLog('info', `Waiting on page: ${page}`);
        }
        break;
    }
  }

  /**
   * Action executed when user enters OTP in the assistant and clicks "Verify OTP"
   */
  public async submitOtpVerification(otpCode: string): Promise<{ success: boolean; message: string }> {
    const validation = validateOtpFormat(otpCode);
    if (!validation.isValid) {
      const err = validation.error || 'Invalid OTP format.';
      this.session.otpState.errorMessage = err;
      this.notify();
      return { success: false, message: err };
    }

    this.session.otpState.isSubmitting = true;
    this.session.otpState.errorMessage = undefined;
    this.session.otpState.lastSubmittedOtp = otpCode;
    this.session.authStatus = 'submitting_otp';
    this.addLog('info', `Populating OTP code into website input...`);
    this.notify();

    // 1. Fill OTP into page elements
    const fillRes = loginAdapter.fillOtp(otpCode);
    if (!fillRes.success) {
      this.session.otpState.isSubmitting = false;
      this.session.otpState.errorMessage = fillRes.message;
      this.session.authStatus = 'awaiting_otp';
      this.addLog('error', fillRes.message);
      this.notify();
      return { success: false, message: fillRes.message };
    }

    // Brief delay before triggering submit
    await new Promise(r => setTimeout(r, 400));

    // 2. Submit the OTP form on the website
    const submitRes = loginAdapter.submitOtp();
    if (!submitRes.success) {
      this.session.otpState.isSubmitting = false;
      this.session.otpState.errorMessage = submitRes.message;
      this.session.authStatus = 'awaiting_otp';
      this.addLog('error', submitRes.message);
      this.notify();
      return { success: false, message: submitRes.message };
    }

    this.addLog('info', 'Submitted OTP to website. Awaiting confirmation...');

    // 3. Bounded check for authentication success or error alerts (up to 12 seconds)
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 24; // 24 * 500ms = 12s

      const checkAuth = setInterval(() => {
        attempts++;

        // Check for visible error banners on page (e.g. "Invalid OTP", "Expired OTP")
        const pageError = loginAdapter.detectPageErrors();
        if (pageError) {
          clearInterval(checkAuth);
          this.session.otpState.isSubmitting = false;
          this.session.otpState.errorMessage = pageError;
          this.session.authStatus = 'auth_failed';
          this.addLog('error', `Website reported: ${pageError}`);
          this.notify();
          resolve({ success: false, message: pageError });
          return;
        }

        // Check for genuine successful authentication
        if (loginAdapter.detectAuthSuccess()) {
          clearInterval(checkAuth);
          this.session.otpState.isSubmitting = false;
          this.session.otpState.isRequired = false;
          this.session.authStatus = 'authenticated';
          this.addLog('success', 'Authentication confirmed! Proceeding to next workflow step.');
          this.notify();

          // Advance state based on newly active page
          this.handlePageTransition(this.session.detectedPage);
          resolve({ success: true, message: 'Authentication confirmed.' });
          return;
        }

        // Timeout fallback
        if (attempts >= maxAttempts) {
          clearInterval(checkAuth);
          this.session.otpState.isSubmitting = false;
          const timeoutMsg = 'Verification timed out. Please check the website response or click Verify directly on the page.';
          this.session.otpState.errorMessage = timeoutMsg;
          this.session.authStatus = 'awaiting_otp';
          this.addLog('warning', timeoutMsg);
          this.notify();
          resolve({ success: false, message: timeoutMsg });
        }
      }, 500);
    });
  }

  private async handleDocumentUploadStage() {
    if (!this.activeProfile) return;

    this.addLog('info', 'Initiating sequential document uploads...');
    const allDocs = await documentRepository.getDocumentsByProfileId(this.activeProfile.id);

    if (allDocs.length === 0) {
      this.setState('ERROR', 'No stored documents found for this profile.');
      return;
    }

    const pendingDocs = allDocs.filter(d => !this.session.uploadedDocumentIds.includes(d.id));

    if (pendingDocs.length === 0) {
      this.addLog('success', 'All applicant documents have already been uploaded.');
      return;
    }

    const uploadRes = await documentAdapter.uploadDocumentsSequentially(
      pendingDocs,
      (docId, status, msg) => {
        if (status === 'uploaded') {
          this.session.uploadedDocumentIds.push(docId);
          this.addLog('success', msg);
        } else if (status === 'error') {
          this.addLog('error', msg);
        } else {
          this.addLog('info', msg);
        }
      }
    );

    if (!uploadRes.success) {
      this.setState('ERROR', uploadRes.errorMessage || 'Document upload failed.');
    } else {
      this.addLog('success', `Completed uploading ${uploadRes.uploadedCount} documents.`);
    }
  }

  private handleCentreSelectionStage() {
    if (!this.activeProfile) return;

    this.addLog('info', `Selecting preferred centre: ${this.activeProfile.preferredCentre}...`);
    const centreRes = centreAdapter.selectPreferredCentre(this.activeProfile.preferredCentre);

    if (centreRes.success) {
      this.addLog('success', centreRes.message);
    } else {
      this.addLog('warning', centreRes.message);
    }
  }

  private handleAppointmentStage() {
    this.addLog('info', 'Scanning for available appointment slots...');
    const slotRes = appointmentAdapter.selectFirstAvailableSlot();

    if (slotRes.success) {
      this.addLog('success', slotRes.message);
    } else {
      this.addLog('info', slotRes.message);
    }
  }
}

export const workflowEngine = new WorkflowEngine();
