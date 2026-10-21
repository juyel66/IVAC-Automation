import {
  WorkflowState,
  IvacPageType,
  WorkflowSession,
  WorkflowLogEntry
} from '../../types/workflow';
import { IvacProfile } from '../../types/profile';
import { documentRepository } from '../../storage/documentRepository';
import { credentialManager } from '../security/credentialManager';
import { loginAdapter } from '../../content/adapters/loginAdapter';
import { documentAdapter } from '../../content/adapters/documentAdapter';
import { centreAdapter } from '../../content/adapters/centreAdapter';
import { appointmentAdapter } from '../../content/adapters/appointmentAdapter';
import { PaymentAdapter } from '../../content/adapters/paymentAdapter';
import { validateOtpFormat } from '../../utils/validation';
import { ivacPageDetector } from '../../content/pageDetector';

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
    captchaState: {
      isRequired: false,
      canVerifyAutomatically: true,
      isSolved: false,
      manualSubmissionRequired: false
    },
    confirmationDetails: undefined,
    logs: []
  };

  private listeners: Set<WorkflowListener> = new Set();
  private activeProfile: IvacProfile | null = null;
  private authCheckTimer: number | null = null;
  private autoSubmitTimer: number | null = null;
  private loginAutofillTimer: number | null = null;
  private isSubmittingLogin = false;

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
    if (this.session.state === nextState && errorMessage === undefined) return;

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
    if (
      !this.session.isPaused &&
      this.session.state !== 'IDLE' &&
      this.session.state !== 'STOPPED' &&
      this.session.state !== 'ERROR' &&
      this.session.state !== 'POST_CONFIRMATION'
    ) {
      this.handlePageTransition(page);
    }
  }

  private clearTimers() {
    if (this.authCheckTimer) {
      window.clearInterval(this.authCheckTimer);
      this.authCheckTimer = null;
    }
    if (this.autoSubmitTimer) {
      window.clearInterval(this.autoSubmitTimer);
      this.autoSubmitTimer = null;
    }
    if (this.loginAutofillTimer) {
      window.clearInterval(this.loginAutofillTimer);
      this.loginAutofillTimer = null;
    }
  }

  public getActiveProfile(): IvacProfile | null {
    return this.activeProfile;
  }

  public setActiveProfile(profile: IvacProfile): void {
    this.activeProfile = profile;
    this.session.activeProfileId = profile.id;
    this.notify();
  }

  /**
   * Primary entry point when user selects a saved profile and clicks "Start"
   */
  public async start(profile: IvacProfile): Promise<void> {
    if (
      this.session.state !== 'IDLE' &&
      this.session.state !== 'PROFILE_SELECTED' &&
      this.session.state !== 'LOGIN_READY' &&
      this.session.state !== 'WAITING_FOR_CAPTCHA' &&
      this.session.state !== 'PAUSED' &&
      this.session.state !== 'STOPPED' &&
      this.session.state !== 'ERROR' &&
      this.session.state !== 'COMPLETED' &&
      this.session.state !== 'POST_CONFIRMATION'
    ) {
      this.addLog('warning', 'Workflow is already active.');
      return;
    }

    // 1. Verify profile documents readiness (primary PDF required)
    if (!profile.primaryDocumentId) {
      this.setState('ERROR', 'Primary applicant PDF document is required before starting.');
      this.addLog('error', 'Cannot start: Primary PDF document is missing.');
      return;
    }

    // 2. Check credentials readiness (unlocked via Master PIN)
    const unlockedPassword = credentialManager.getUnlockedPassword(profile.id);
    if (!unlockedPassword) {
      this.setState('ERROR', 'Profile password is locked. Please enter your Master PIN to unlock credentials.');
      this.addLog('error', 'Cannot start: Profile password is locked. Master PIN required.');
      return;
    }

    // Automatically dismiss any advisory/notice modals so they never block
    loginAdapter.dismissNoticePopups();

    this.activeProfile = profile;
    this.session.activeProfileId = profile.id;
    this.session.isPaused = false;
    this.session.errorMessage = null;
    this.session.uploadedDocumentIds = [];
    this.session.currentDocumentIndex = 0;
    this.session.authStatus = 'idle';
    this.session.otpState = { isRequired: false, isSubmitting: false };
    this.session.captchaState = {
      isRequired: false,
      canVerifyAutomatically: true,
      isSolved: false,
      manualSubmissionRequired: false
    };
    this.session.confirmationDetails = undefined;
    this.isSubmittingLogin = false;

    this.setState('PROFILE_SELECTED');
    this.addLog('info', `Starting assistant workflow for profile: "${profile.displayName}"`);

    // 3. Inspect current page on the supported IVAC website
    const liveDetected = ivacPageDetector.detect().pageType;
    const pathname = typeof window !== 'undefined' ? (window.location.pathname || '').toLowerCase() : '';
    const detected = liveDetected !== 'UNKNOWN' ? liveDetected : this.session.detectedPage;

    if (detected === 'LOGIN' || loginAdapter.isOnLoginPage() || pathname.includes('/signin') || pathname.includes('/login')) {
      this.handlePageTransition('LOGIN');
    } else if (detected === 'OTP_VERIFICATION' || pathname.includes('/otp') || pathname.includes('/verify')) {
      this.handlePageTransition('OTP_VERIFICATION');
    } else if (detected === 'DOCUMENT_UPLOAD' || pathname.includes('/file-upload') || pathname.includes('/document') || pathname.includes('/upload')) {
      this.handlePageTransition('DOCUMENT_UPLOAD');
    } else if (detected === 'CENTRE_SELECTION' || pathname.includes('/mission') || pathname.includes('/centre') || pathname.includes('/center')) {
      this.handlePageTransition('CENTRE_SELECTION');
    } else if (detected === 'APPOINTMENT_CALENDAR' || pathname.includes('/time-slot') || pathname.includes('/slot')) {
      const isSlotRoute = pathname.includes('/time-slot') || pathname.includes('/slot');
      const hasSlots = appointmentAdapter.findSelectableSlots().length > 0;
      if (isSlotRoute || hasSlots) {
        this.handlePageTransition('APPOINTMENT_CALENDAR');
      } else {
        this.initiateLoginFlow(profile);
      }
    } else {
      this.initiateLoginFlow(profile);
    }
  }

  /**
   * Helper to initiate login flow from landing or unauthenticated pages
   */
  private async initiateLoginFlow(profile: IvacProfile): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('ivac_auto_start_profile', profile.id);
        window.sessionStorage.setItem('ivac_auto_start_ts', Date.now().toString());
      }
    } catch {
      // ignore
    }

    this.setState('LOGIN_READY');
    this.addLog('info', 'Opening IVAC login page...');

    const navRes = loginAdapter.navigateToLoginPage();
    if (navRes.navigated) {
      this.addLog('info', navRes.message);
    } else if (!navRes.success) {
      this.addLog('warning', navRes.message);
    } else {
      await this.handlePageTransition('LOGIN');
    }
  }

  public pause(reason?: string) {
    if (this.session.isPaused) return;

    this.clearTimers();
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
    this.clearTimers();
    this.isSubmittingLogin = false;
    this.session.isPaused = false;
    this.session.pausedReason = undefined;
    this.session.otpState = { isRequired: false, isSubmitting: false };
    this.session.authStatus = 'idle';
    this.session.confirmationDetails = undefined;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('ivac_auto_start_profile');
        window.sessionStorage.removeItem('ivac_auto_start_ts');
      }
    } catch {}
    this.setState('STOPPED');
    this.addLog('info', 'Workflow was stopped by user.');
  }

  public reset() {
    this.clearTimers();
    this.isSubmittingLogin = false;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('ivac_auto_start_profile');
        window.sessionStorage.removeItem('ivac_auto_start_ts');
      }
    } catch {}
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
      captchaState: {
        isRequired: false,
        canVerifyAutomatically: true,
        isSolved: false,
        manualSubmissionRequired: false
      },
      confirmationDetails: undefined,
      logs: []
    };
    this.activeProfile = null;
    this.addLog('info', 'Workflow reset to IDLE.');
  }

  /**
   * Reactive transitions triggered by page detector or stage completion
   */
  public async handlePageTransition(page: IvacPageType) {
    if (this.session.isPaused) return;
    if (!this.activeProfile) return;
    if (this.session.state === 'POST_CONFIRMATION' && page !== 'CENTRE_SELECTION' && page !== 'APPOINTMENT_CALENDAR') return;

    switch (page) {
      case 'LOGIN': {
        this.startLoginAutofillLoop();
        break;
      }

      case 'OTP_VERIFICATION': {
        this.clearTimers();
        this.isSubmittingLogin = false;
        this.setState('WAITING_FOR_OTP');
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
        this.clearTimers();
        this.session.otpState.isRequired = false;
        this.session.authStatus = 'authenticated';
        this.setState('DOCUMENT_UPLOAD');
        await this.handleDocumentUploadStage();
        break;

      case 'CENTRE_SELECTION':
        this.clearTimers();
        this.session.otpState.isRequired = false;
        this.session.authStatus = 'authenticated';
        await this.handleCentreSelectionStage();
        break;

      case 'APPOINTMENT_CALENDAR':
        this.clearTimers();
        this.session.otpState.isRequired = false;
        this.session.authStatus = 'authenticated';
        await this.handleAppointmentSlotStage();
        break;

      case 'PAYMENT':
        this.clearTimers();
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem('ivac_auto_start_profile');
            window.sessionStorage.removeItem('ivac_auto_start_ts');
          }
        } catch {}
        this.setState('PAYMENT_HANDOFF');
        this.addLog('warning', PaymentAdapter.HANDOFF_MESSAGE);
        break;

      default:
        // If we were awaiting auth and detected a post-auth page with auth confirmation
        if (
          (this.session.state === 'WAITING_FOR_CAPTCHA' ||
            this.session.state === 'LOGIN_SUBMISSION_PENDING' ||
            this.session.state === 'OTP_REQUEST_PENDING' ||
            this.session.state === 'WAITING_FOR_OTP' ||
            this.session.state === 'OTP_SUBMISSION_PENDING' ||
            this.session.state === 'AUTHENTICATION_PENDING' ||
            this.session.state === 'WAITING_FOR_USER_AUTHENTICATION') &&
          loginAdapter.detectAuthSuccess()
        ) {
          this.clearTimers();
          this.session.authStatus = 'authenticated';
          this.session.otpState.isRequired = false;
          this.addLog('success', 'User authentication confirmed by website.');
          await this.proceedToDocumentUpload();
        } else {
          this.addLog('info', `Waiting on page: ${page}`);
        }
        break;
    }
  }

  /**
   * Smoothly attempts to autofill contact number and password.
   * If React component is still mounting, polls every 200ms up to 50 times (10 seconds)
   * until inputs are ready and verified, then immediately triggers autoSubmitLoginWhenReady().
   */
  public startLoginAutofillLoop(): void {
    if (this.loginAutofillTimer) {
      window.clearInterval(this.loginAutofillTimer);
      this.loginAutofillTimer = null;
    }

    if (!this.activeProfile) return;

    this.setState('LOGIN_READY');
    this.addLog('info', 'Populating profile login credentials...');

    const tryFill = (): boolean => {
      if (this.session.isPaused || this.session.state === 'STOPPED' || !this.activeProfile) {
        return false;
      }

      // If already past login stage, stop
      if (
        this.session.state === 'AUTHENTICATION_PENDING' ||
        this.session.state === 'WAITING_FOR_OTP' ||
        this.session.state === 'DOCUMENT_UPLOAD' ||
        this.session.state === 'COMPLETED'
      ) {
        return true;
      }

      const password = credentialManager.getUnlockedPassword(this.activeProfile.id) || undefined;
      const loginRes = loginAdapter.fillCredentials(
        this.activeProfile.mobileNumber,
        password
      );

      if (loginRes.success) {
        this.addLog('success', 'Mobile and password populated.');
        if (loginRes.hasCaptcha) {
          if (this.session.captchaState) {
            this.session.captchaState.isRequired = true;
          }
          this.session.authStatus = 'awaiting_captcha';
          this.setState('WAITING_FOR_CAPTCHA');
        }
        // Auto-submit login immediately to send OTP without manual permission prompt
        this.autoSubmitLoginWhenReady();
        return true;
      }

      return false;
    };

    // 1. Attempt immediately
    if (tryFill()) {
      return;
    }

    // 2. Poll smoothly every 200ms while React renders the login form
    let attempts = 0;
    const maxAttempts = 50; // 50 * 200ms = 10 seconds

    this.loginAutofillTimer = window.setInterval(() => {
      attempts++;

      if (this.session.isPaused || this.session.state === 'STOPPED') {
        if (this.loginAutofillTimer) {
          window.clearInterval(this.loginAutofillTimer);
          this.loginAutofillTimer = null;
        }
        return;
      }

      if (tryFill()) {
        if (this.loginAutofillTimer) {
          window.clearInterval(this.loginAutofillTimer);
          this.loginAutofillTimer = null;
        }
        return;
      }

      if (attempts >= maxAttempts) {
        if (this.loginAutofillTimer) {
          window.clearInterval(this.loginAutofillTimer);
          this.loginAutofillTimer = null;
        }
        this.setState('LOGIN_READY', 'Could not locate contact number or password fields. Please check page.');
        this.addLog('warning', 'Could not locate contact number or password fields after repeated attempts.');
      }
    }, 200);
  }

  /**
   * Automatically monitors the login submit button and clicks it as soon as it is enabled.
   * No manual "Continue / Request OTP" button click or permission required from user.
   */
  public autoSubmitLoginWhenReady(): void {
    if (this.isSubmittingLogin) {
      return;
    }

    if (this.autoSubmitTimer) {
      window.clearInterval(this.autoSubmitTimer);
      this.autoSubmitTimer = null;
    }

    // Check if enabled and ready immediately (with brief delay for React synthetic state settling)
    if (loginAdapter.isSubmitButtonReady()) {
      setTimeout(() => {
        if (!this.session.isPaused && this.session.state !== 'STOPPED' && this.session.state !== 'AUTHENTICATION_PENDING') {
          this.requestOtpAfterCaptcha();
        }
      }, 250);
      return;
    }

    // Otherwise, actively monitor every 250ms until button becomes enabled and ready
    let checks = 0;
    const maxChecks = 120; // 120 * 250ms = 30 seconds

    this.autoSubmitTimer = window.setInterval(() => {
      checks++;

      if (this.session.isPaused || this.session.state === 'STOPPED') {
        if (this.autoSubmitTimer) {
          window.clearInterval(this.autoSubmitTimer);
          this.autoSubmitTimer = null;
        }
        return;
      }

      // Check if button and CAPTCHA verification are ready
      if (loginAdapter.isSubmitButtonReady()) {
        if (this.autoSubmitTimer) {
          window.clearInterval(this.autoSubmitTimer);
          this.autoSubmitTimer = null;
        }
        this.addLog('info', 'Sign in ready! Clicking automatically to send OTP...');
        this.requestOtpAfterCaptcha();
        return;
      }

      if (checks >= maxChecks) {
        if (this.autoSubmitTimer) {
          window.clearInterval(this.autoSubmitTimer);
          this.autoSubmitTimer = null;
        }
        this.addLog('warning', 'Sign in button remained disabled. Please check verification on the page.');
      }
    }, 250);
  }

  /**
   * Submits the official login form to request OTP and monitors response
   */
  public async requestOtpAfterCaptcha(): Promise<{
    success: boolean;
    manualRequired?: boolean;
    message: string;
  }> {
    if (this.isSubmittingLogin) {
      return { success: false, message: 'Login request is already in progress.' };
    }

    // 1. Verify expected login form elements
    const formEls = loginAdapter.findFormElements();
    if (!formEls.mobileInput || !formEls.submitButton) {
      const err = 'Expected login form fields or submit button are missing on the page.';
      this.addLog('error', err);
      return { success: false, message: err };
    }

    // 2. Verify that the login submit button is enabled by the website
    if (!loginAdapter.isSubmitButtonEnabled()) {
      const captchaStatus = loginAdapter.checkCaptchaCompletion();
      const err = captchaStatus.message || 'Login submit button is currently disabled. Please complete verification on the page.';
      this.addLog('warning', err);
      return { success: false, message: err };
    }

    // 2.1 Verify CAPTCHA status if CAPTCHA is present on page
    const captchaStatus = loginAdapter.checkCaptchaCompletion();
    if (captchaStatus.hasCaptcha && !captchaStatus.verified) {
      if (!captchaStatus.canCheck) {
        const msg = captchaStatus.message || 'Website CAPTCHA completion cannot be verified automatically. Please submit the login form manually on the page.';
        this.addLog('warning', msg);
        return { success: false, manualRequired: true, message: msg };
      }
      const msg = captchaStatus.message || 'Please complete the CAPTCHA verification on the page.';
      this.addLog('warning', msg);
      return { success: false, message: msg };
    }

    // 3. Submit official login form once
    this.isSubmittingLogin = true;
    this.setState('LOGIN_SUBMISSION_PENDING');
    this.session.authStatus = 'login_submission_pending';
    this.notify();

    const submitRes = loginAdapter.submitLoginForm();
    if (!submitRes.success) {
      this.isSubmittingLogin = false;
      this.setState('LOGIN_READY', submitRes.message);
      this.addLog('error', submitRes.message);
      return submitRes;
    }

    this.setState('AUTHENTICATION_PENDING');
    this.session.authStatus = 'authentication_pending';
    this.addLog('info', 'Submitted sign in form. Waiting for portal to send OTP...');

    // 4. Bounded check for OTP page or login rejection (up to 20s)
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 40; // 40 * 500ms = 20s
      this.clearTimers();

      this.authCheckTimer = window.setInterval(() => {
        attempts++;

        // Detect explicit login rejection / error banners
        const pageErr = loginAdapter.detectPageErrors();
        if (pageErr) {
          this.clearTimers();
          this.isSubmittingLogin = false;
          this.setState('LOGIN_READY', pageErr);
          this.session.authStatus = 'auth_failed';
          this.addLog('error', `Portal response error: ${pageErr}`);
          this.notify();
          resolve({ success: false, message: pageErr });
          return;
        }

        // Detect OTP verification page reached
        const pageDetected = ivacPageDetector.detect().pageType;
        const otpEls = loginAdapter.findOtpElements();
        const isOtpPage =
          pageDetected === 'OTP_VERIFICATION' ||
          this.session.detectedPage === 'OTP_VERIFICATION' ||
          !!otpEls.singleInput ||
          otpEls.segmentedInputs.length > 0;

        if (isOtpPage) {
          this.clearTimers();
          this.isSubmittingLogin = false;
          this.session.detectedPage = 'OTP_VERIFICATION';
          this.session.otpState = { isRequired: true, isSubmitting: false };
          this.session.authStatus = 'awaiting_otp';
          this.setState('WAITING_FOR_OTP');
          this.addLog('success', 'OTP verification page reached. Enter code in the assistant.');
          this.notify();
          resolve({ success: true, message: 'OTP verification page reached.' });
          return;
        }

        // Detect direct authentication success (if no OTP required)
        if (pageDetected === 'DOCUMENT_UPLOAD' || loginAdapter.detectAuthSuccess()) {
          this.clearTimers();
          this.isSubmittingLogin = false;
          this.session.authStatus = 'authenticated';
          this.addLog('success', 'Authentication confirmed!');
          this.proceedToDocumentUpload();
          resolve({ success: true, message: 'Authentication confirmed.' });
          return;
        }

        if (attempts >= maxAttempts) {
          this.clearTimers();
          this.isSubmittingLogin = false;
          const timeoutMsg = 'Request timed out waiting for portal response. Please check website state.';
          this.setState('LOGIN_READY', timeoutMsg);
          this.session.authStatus = 'awaiting_captcha';
          this.addLog('warning', timeoutMsg);
          this.notify();
          resolve({ success: false, message: timeoutMsg });
        }
      }, 500);
    });
  }

  /**
   * Action executed when user enters OTP in the assistant and clicks "Verify OTP"
   */
  public async submitOtpVerification(otpCode: string): Promise<{ success: boolean; message: string }> {
    // Prevent duplicate submissions while waiting for a response
    if (this.session.state === 'OTP_SUBMISSION_PENDING' || this.session.otpState.isSubmitting) {
      return { success: false, message: 'OTP verification is already in progress.' };
    }

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
    this.setState('OTP_SUBMISSION_PENDING');
    this.addLog('info', 'Populating OTP code into website input...');
    this.notify();

    // 1. Fill website's correct OTP field and verify DOM value
    const fillRes = loginAdapter.fillOtp(otpCode);
    if (!fillRes.success) {
      this.session.otpState.isSubmitting = false;
      this.session.otpState.errorMessage = fillRes.message;
      this.session.authStatus = 'awaiting_otp';
      this.setState('WAITING_FOR_OTP', fillRes.message);
      this.addLog('error', fillRes.message);
      this.notify();
      return { success: false, message: fillRes.message };
    }

    // Brief delay before triggering submit
    await new Promise((r) => setTimeout(r, 400));

    // 2. Click official website's OTP verification button once
    const submitRes = loginAdapter.submitOtp();
    if (!submitRes.success) {
      this.session.otpState.isSubmitting = false;
      this.session.otpState.errorMessage = submitRes.message;
      this.session.authStatus = 'awaiting_otp';
      this.setState('WAITING_FOR_OTP', submitRes.message);
      this.addLog('error', submitRes.message);
      this.notify();
      return { success: false, message: submitRes.message };
    }

    this.setState('AUTHENTICATION_PENDING');
    this.session.authStatus = 'authentication_pending';
    this.addLog('info', 'Submitted OTP to website. Awaiting authentication confirmation...');
    this.notify();

    // 3. Bounded check for authentication success or error alerts (up to 15 seconds)
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // 30 * 500ms = 15s
      this.clearTimers();

      this.authCheckTimer = window.setInterval(async () => {
        attempts++;

        // Detect explicit authentication errors
        const pageError = loginAdapter.detectPageErrors();
        if (pageError) {
          this.clearTimers();
          this.session.otpState.isSubmitting = false;
          this.session.otpState.errorMessage = pageError;
          this.session.authStatus = 'auth_failed';
          this.setState('WAITING_FOR_OTP', pageError);
          this.addLog('error', `Website reported authentication error: ${pageError}`);
          this.notify();
          resolve({ success: false, message: pageError });
          return;
        }

        // Confirm genuine successful authentication or transition to document upload
        const pageDetected = ivacPageDetector.detect().pageType;
        if (loginAdapter.detectAuthSuccess() || pageDetected === 'DOCUMENT_UPLOAD') {
          this.clearTimers();
          this.session.otpState.isSubmitting = false;
          this.session.otpState.isRequired = false;
          this.session.authStatus = 'authenticated';
          this.addLog('success', 'Authentication confirmed! Proceeding to document upload...');
          this.notify();

          await this.proceedToDocumentUpload();
          resolve({ success: true, message: 'Authentication confirmed.' });
          return;
        }

        // Timeout fallback
        if (attempts >= maxAttempts) {
          this.clearTimers();
          this.session.otpState.isSubmitting = false;
          const timeoutMsg =
            'Verification timed out. Please check the website response or click Verify directly on the page.';
          this.session.otpState.errorMessage = timeoutMsg;
          this.session.authStatus = 'awaiting_otp';
          this.setState('WAITING_FOR_OTP', timeoutMsg);
          this.addLog('warning', timeoutMsg);
          this.notify();
          resolve({ success: false, message: timeoutMsg });
        }
      }, 500);
    });
  }

  /**
   * After confirmed authentication, detect whether portal automatically opens document-upload page
   * or navigate using a verified visible control.
   */
  /**
   * After confirmed authentication, dismisses all popups and proceeds directly to
   * https://appointment.ivacbd.com/appointment/file-upload
   */
  public async proceedToDocumentUpload(): Promise<void> {
    // 1. Dismiss any notice/advisory/intro modals
    loginAdapter.dismissNoticePopups();

    // 2. Save auto-start marker so workflow resumes seamlessly across pages
    if (this.activeProfile && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('ivac_auto_start_profile', this.activeProfile.id);
      window.sessionStorage.setItem('ivac_auto_start_ts', Date.now().toString());
    }

    const currentDetected = this.session.detectedPage;
    const detectedFromDom = ivacPageDetector.detect().pageType;
    const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';

    if (
      pathname.includes('/file-upload') ||
      pathname.includes('/document') ||
      pathname.includes('/upload') ||
      currentDetected === 'DOCUMENT_UPLOAD' ||
      detectedFromDom === 'DOCUMENT_UPLOAD'
    ) {
      this.setState('DOCUMENT_UPLOAD');
      await this.handleDocumentUploadStage();
      return;
    }

    // Try visible verified navigation control (e.g. Next Step button or portal link)
    const navRes = loginAdapter.navigateToDocumentUpload();
    if (navRes.alreadyOnPage) {
      this.setState('DOCUMENT_UPLOAD');
      await this.handleDocumentUploadStage();
      return;
    }

    if (navRes.navigated) {
      this.addLog('info', navRes.message);
      // Wait for navigation transition
      await new Promise((r) => setTimeout(r, 1200));
      const postNavDetected = ivacPageDetector.detect().pageType;
      if (postNavDetected === 'DOCUMENT_UPLOAD') {
        this.setState('DOCUMENT_UPLOAD');
        await this.handleDocumentUploadStage();
      }
    } else {
      // Direct navigation to file-upload endpoint
      try {
        window.location.href = 'https://appointment.ivacbd.com/appointment/file-upload';
      } catch {}
    }
  }

  /**
   * Handles document upload stage: primary PDF first, then additionals in order.
   * Validates 500KB limit & PDF type, then verifies uploads.
   */
  private async handleDocumentUploadStage() {
    if (!this.activeProfile) return;

    this.addLog('info', 'Initiating sequential applicant document uploads...');
    const allDocs = await documentRepository.getDocumentsByProfileId(this.activeProfile.id);

    if (allDocs.length === 0) {
      this.setState('ERROR', 'No stored documents found for this profile.');
      return;
    }

    const pendingDocs = allDocs.filter((d) => !this.session.uploadedDocumentIds.includes(d.id));

    if (pendingDocs.length === 0) {
      this.addLog('success', 'All applicant documents have already been uploaded.');
      this.setState('DOCUMENT_UPLOAD_VERIFICATION');
      this.transitionToDocumentConfirmation();
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
      return;
    }

    this.addLog('success', `Completed uploading ${uploadRes.uploadedCount} documents.`);
    this.setState('DOCUMENT_UPLOAD_VERIFICATION');
    this.transitionToDocumentConfirmation();
  }

  /**
   * After all documents are uploaded and verified, prepares for document confirmation
   * and automatically monitors the confirm button to click it when ready
   */
  private transitionToDocumentConfirmation() {
    this.setState('WAITING_FOR_DOCUMENT_CONFIRMATION');
    const isEnabled = documentAdapter.isConfirmAllButtonEnabled();
    this.addLog(
      'info',
      isEnabled
        ? 'All documents verified. "Confirm All Information is Correct" button is ready.'
        : 'All documents verified. Waiting for portal confirmation button to become enabled...'
    );

    // Automatically monitor confirm button to click it as soon as it is enabled
    this.autoConfirmDocumentsWhenReady();
  }

  /**
   * Automatically monitors the "Confirm All Information is Correct" button until enabled, then clicks it
   */
  public autoConfirmDocumentsWhenReady(): void {
    if (this.autoSubmitTimer) {
      window.clearInterval(this.autoSubmitTimer);
      this.autoSubmitTimer = null;
    }

    setTimeout(() => {
      let checks = 0;
      const maxChecks = 120; // 30s

      this.autoSubmitTimer = window.setInterval(async () => {
        checks++;

        if (this.session.isPaused || this.session.state === 'STOPPED') {
          if (this.autoSubmitTimer) {
            window.clearInterval(this.autoSubmitTimer);
            this.autoSubmitTimer = null;
          }
          return;
        }

        if (
          this.session.state !== 'WAITING_FOR_DOCUMENT_CONFIRMATION' &&
          this.session.state !== 'DOCUMENT_UPLOAD_VERIFICATION'
        ) {
          if (this.autoSubmitTimer) {
            window.clearInterval(this.autoSubmitTimer);
            this.autoSubmitTimer = null;
          }
          return;
        }

        if (documentAdapter.isConfirmAllButtonEnabled()) {
          if (this.autoSubmitTimer) {
            window.clearInterval(this.autoSubmitTimer);
            this.autoSubmitTimer = null;
          }
          this.addLog('info', 'Confirmation button enabled! Clicking automatically...');
          const res = await this.confirmDocumentInformation();
          if (res.success) {
            // Once modal is detected, immediately proceed to Save & Continue
            await this.saveAndContinueConfirmation();
          }
          return;
        }

        if (checks >= maxChecks) {
          if (this.autoSubmitTimer) {
            window.clearInterval(this.autoSubmitTimer);
            this.autoSubmitTimer = null;
          }
          this.addLog('warning', '"Confirm All Information is Correct" button remained disabled. Please check Turnstile on page.');
        }
      }, 500);
    }, 800);
  }

  /**
   * Action executed when user clicks "Confirm All Information is Correct" in the assistant
   */
  public async confirmDocumentInformation(): Promise<{ success: boolean; isBlocked?: boolean; message: string }> {
    if (this.session.state !== 'WAITING_FOR_DOCUMENT_CONFIRMATION' && this.session.state !== 'DOCUMENT_UPLOAD_VERIFICATION') {
      return {
        success: false,
        message: 'Workflow is not currently in the document confirmation stage.'
      };
    }

    // Check if website button is enabled
    if (!documentAdapter.isConfirmAllButtonEnabled()) {
      const msg = 'The "Confirm All Information is Correct" button is currently disabled on the website. Please complete any remaining verification (e.g. Turnstile) on the page.';
      this.addLog('warning', msg);
      return { success: false, isBlocked: true, message: msg };
    }

    // Click official "Confirm All Information is Correct" button once
    const clickRes = documentAdapter.clickConfirmAllButton();
    if (!clickRes.success) {
      this.addLog('error', clickRes.message);
      return clickRes;
    }

    this.addLog('info', 'Clicked "Confirm All Information is Correct". Waiting for confirmation modal...');

    // Bounded check for confirmation modal ("Please confirm your details")
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20; // 20 * 500ms = 10s
      this.clearTimers();

      this.authCheckTimer = window.setInterval(() => {
        attempts++;

        const modal = documentAdapter.findConfirmationModal();
        if (modal) {
          this.clearTimers();
          this.session.confirmationDetails = {
            heading: modal.headingText,
            description: modal.descriptionText,
            isModalVisible: true,
            canConfirm: true
          };
          this.setState('DETAILS_CONFIRMATION_MODAL');
          this.addLog('success', `Detected confirmation modal: "${modal.headingText}". Please verify details.`);
          this.notify();
          resolve({ success: true, message: 'Confirmation modal is open.' });
          return;
        }

        if (attempts >= maxAttempts) {
          this.clearTimers();
          const timeoutMsg = 'Timed out waiting for "Please confirm your details" modal to appear. Please verify on the page.';
          this.addLog('warning', timeoutMsg);
          resolve({ success: false, message: timeoutMsg });
        }
      }, 500);
    });
  }

  /**
   * Action executed when user explicitly clicks "Confirm Details & Continue" for the modal
   */
  public async saveAndContinueConfirmation(): Promise<{ success: boolean; message: string }> {
    if (this.session.state === 'SAVE_AND_CONTINUE_PENDING') {
      return { success: false, message: 'Save & Continue submission is already in progress.' };
    }

    const modal = documentAdapter.findConfirmationModal();
    if (!modal) {
      const err = 'Confirmation modal is not currently visible on the website.';
      this.addLog('error', err);
      return { success: false, message: err };
    }

    if (!documentAdapter.isSaveAndContinueButtonEnabled()) {
      const err = 'The "Save & Continue" button is currently disabled.';
      this.addLog('warning', err);
      return { success: false, message: err };
    }

    this.setState('SAVE_AND_CONTINUE_PENDING');
    this.addLog('info', 'Clicking "Save & Continue" in confirmation modal...');

    const clickRes = documentAdapter.clickSaveAndContinue();
    if (!clickRes.success) {
      this.setState('DETAILS_CONFIRMATION_MODAL', clickRes.message);
      this.addLog('error', clickRes.message);
      return clickRes;
    }

    // Bounded check for modal closure or navigation transition (up to 10s)
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 20; // 10s
      this.clearTimers();

      this.authCheckTimer = window.setInterval(() => {
        attempts++;

        const currentModal = documentAdapter.findConfirmationModal();
        const pageDetected = ivacPageDetector.detect().pageType;

        // Modal closed or route transitioned -> confirmation succeeded
        if (!currentModal || pageDetected !== 'DOCUMENT_UPLOAD') {
          this.clearTimers();
          if (this.session.confirmationDetails) {
            this.session.confirmationDetails.isModalVisible = false;
          }
          this.setState('POST_CONFIRMATION');
          this.addLog('success', 'Applicant details confirmed and saved successfully with IVAC portal.');
          this.notify();

          // Prepare auto-start for mission page
          if (this.activeProfile && typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem('ivac_auto_start_profile', this.activeProfile.id);
            window.sessionStorage.setItem('ivac_auto_start_ts', Date.now().toString());
          }

          // Fallback redirect to mission page if portal doesn't automatically route
          setTimeout(() => {
            const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
            if (!currentPath.includes('/mission')) {
              window.location.href = 'https://appointment.ivacbd.com/appointment/mission';
            }
          }, 2000);

          resolve({ success: true, message: 'Details confirmed and saved successfully.' });
          return;
        }

        if (attempts >= maxAttempts) {
          this.clearTimers();
          // Report state without repeatedly clicking
          const msg = 'Save & Continue triggered. Result verification timed out. Please check website state.';
          this.setState('DETAILS_CONFIRMATION_MODAL', msg);
          this.addLog('warning', msg);
          this.notify();
          resolve({ success: false, message: msg });
        }
      }, 500);
    });
  }

  /**
   * Handles IVAC centre selection stage on /appointment/mission
   */
  public async handleCentreSelectionStage(): Promise<void> {
    if (!this.activeProfile) return;

    this.setState('CENTRE_SELECTION');
    const targetCentre = this.activeProfile.preferredCentre;
    this.addLog('info', `Selecting IVAC center "${targetCentre}"...`);

    let attempts = 0;
    const maxAttempts = 50; // 10s

    const centreTimer = window.setInterval(async () => {
      attempts++;

      if (this.session.isPaused || this.session.state === 'STOPPED' || !this.activeProfile) {
        window.clearInterval(centreTimer);
        return;
      }

      const res = centreAdapter.selectPreferredCentre(targetCentre);
      if (res.success) {
        window.clearInterval(centreTimer);
        this.addLog('success', res.message);
        // Automatically submit mission & IVAC center confirmation
        await this.autoSubmitCentreSelection();
        return;
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(centreTimer);
        this.setState('CENTRE_SELECTION', res.message || 'Could not select IVAC centre. Please select manually on the page.');
        this.addLog('warning', res.message);
      }
    }, 250);
  }

  /**
   * Automatically monitors the "Confirm Mission & IVAC Center" button until enabled, then clicks it
   */
  public async autoSubmitCentreSelection(): Promise<{ success: boolean; message: string }> {
    let attempts = 0;
    const maxAttempts = 40; // 10s

    const submitTimer = window.setInterval(() => {
      attempts++;

      if (this.session.isPaused || this.session.state === 'STOPPED') {
        window.clearInterval(submitTimer);
        return;
      }

      if (centreAdapter.isConfirmCentreButtonEnabled()) {
        window.clearInterval(submitTimer);
        this.addLog('info', 'Clicking "Confirm Mission & IVAC Center"...');
        const clickRes = centreAdapter.clickConfirmCentreButton();
        if (clickRes.success) {
          this.addLog('success', 'Confirmed Mission & IVAC Center! Navigating to appointment slot...');
          // Prepare auto-start for slot page
          if (this.activeProfile && typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem('ivac_auto_start_profile', this.activeProfile.id);
            window.sessionStorage.setItem('ivac_auto_start_ts', Date.now().toString());
          }
          // Fallback navigation after 3s if route hasn't changed
          setTimeout(() => {
            const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
            if (!currentPath.includes('/slot') && !currentPath.includes('/time-slot')) {
              window.location.href = 'https://appointment.ivacbd.com/appointment/time-slot';
            }
          }, 3000);
        } else {
          this.addLog('error', clickRes.message);
        }
        return;
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(submitTimer);
        this.addLog('warning', 'Confirm Mission & IVAC Center button was not enabled. Please verify on the page.');
      }
    }, 250);

    return { success: true, message: 'Initiated mission and centre confirmation.' };
  }

  /**
   * Handles appointment date and slot selection on /appointment/time-slot
   */
  public async handleAppointmentSlotStage(): Promise<void> {
    this.setState('APPOINTMENT_SELECTION');
    this.addLog('info', 'Checking available appointment dates and slots on calendar...');

    let attempts = 0;
    const maxAttempts = 50; // 15s

    const slotTimer = window.setInterval(async () => {
      attempts++;

      if (this.session.isPaused || this.session.state === 'STOPPED') {
        window.clearInterval(slotTimer);
        return;
      }

      const res = appointmentAdapter.selectFirstAvailableSlot();
      if (res.success) {
        window.clearInterval(slotTimer);
        this.addLog('success', res.message);
        this.addLog('info', 'Waiting for Turnstile verification to enable "Continue Booking"...');
        this.autoSubmitAppointmentSlotWhenReady();
        return;
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(slotTimer);
        this.addLog('warning', res.message);
      }
    }, 300);
  }

  /**
   * Automatically monitors the "Continue Booking" button until enabled, then clicks it
   */
  public autoSubmitAppointmentSlotWhenReady(): void {
    let attempts = 0;
    const maxAttempts = 120; // 30s

    const timer = window.setInterval(() => {
      attempts++;

      if (this.session.isPaused || this.session.state === 'STOPPED') {
        window.clearInterval(timer);
        return;
      }

      if (appointmentAdapter.isContinueBookingButtonEnabled()) {
        window.clearInterval(timer);
        this.addLog('info', 'Clicking "Continue Booking"...');
        appointmentAdapter.clickContinueBooking();
        return;
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(timer);
        this.addLog('warning', 'Continue Booking button remained disabled. Please complete verification on page.');
      }
    }, 250);
  }
}

export const workflowEngine = new WorkflowEngine();
