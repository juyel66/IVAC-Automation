import { WorkflowState, IvacPageType, WorkflowSession, WorkflowLogEntry } from '../../types/workflow';
import { IvacProfile } from '../../types/profile';
import { documentRepository } from '../../storage/documentRepository';
import { loginAdapter } from '../../content/adapters/loginAdapter';
import { documentAdapter } from '../../content/adapters/documentAdapter';
import { centreAdapter } from '../../content/adapters/centreAdapter';
import { appointmentAdapter } from '../../content/adapters/appointmentAdapter';
import { PaymentAdapter } from '../../content/adapters/paymentAdapter';

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
    logs: []
  };

  private listeners: Set<WorkflowListener> = new Set();
  private sessionPassword: string | null = null;
  private activeProfile: IvacProfile | null = null;

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

    this.session.logs = [entry, ...this.session.logs.slice(0, 49)]; // Keep last 50 logs
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
  public async start(profile: IvacProfile, sessionPassword?: string): Promise<void> {
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

    this.activeProfile = profile;
    this.sessionPassword = sessionPassword || null;
    this.session.activeProfileId = profile.id;
    this.session.isPaused = false;
    this.session.errorMessage = null;
    this.session.uploadedDocumentIds = [];
    this.session.currentDocumentIndex = 0;

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
    this.session.isPaused = false;
    this.session.pausedReason = undefined;
    this.sessionPassword = null;
    this.setState('STOPPED');
    this.addLog('info', 'Workflow was stopped by user.');
  }

  public reset() {
    this.session = {
      state: 'IDLE',
      activeProfileId: null,
      detectedPage: 'UNKNOWN',
      currentDocumentIndex: 0,
      uploadedDocumentIds: [],
      errorMessage: null,
      isPaused: false,
      logs: []
    };
    this.activeProfile = null;
    this.sessionPassword = null;
    this.addLog('info', 'Workflow reset to IDLE.');
  }

  /**
   * Reactive transitions triggered by page detector or stage completion
   */
  private async handlePageTransition(page: IvacPageType) {
    if (this.session.isPaused) return;
    if (!this.activeProfile) return;

    switch (page) {
      case 'LOGIN':
        this.setState('LOGIN_READY');
        this.addLog('info', 'Executing login helper...');
        const loginRes = loginAdapter.fillCredentials(
          this.activeProfile.mobileNumber,
          this.sessionPassword || undefined
        );
        if (loginRes.success) {
          this.setState('WAITING_FOR_USER_AUTHENTICATION');
          this.addLog('success', loginRes.message);
        } else {
          this.addLog('warning', loginRes.message);
        }
        break;

      case 'OTP_VERIFICATION':
        this.setState('WAITING_FOR_USER_AUTHENTICATION');
        this.addLog('info', 'OTP verification detected. Please enter your SMS code on the page.');
        break;

      case 'DOCUMENT_UPLOAD':
        this.setState('DOCUMENT_UPLOAD');
        await this.handleDocumentUploadStage();
        break;

      case 'CENTRE_SELECTION':
        this.setState('CENTRE_SELECTION');
        this.handleCentreSelectionStage();
        break;

      case 'APPOINTMENT_CALENDAR':
        this.setState('APPOINTMENT_SELECTION');
        this.handleAppointmentStage();
        break;

      case 'PAYMENT':
        // Mandatory Safety Stop
        this.setState('PAYMENT_HANDOFF');
        this.addLog('warning', PaymentAdapter.HANDOFF_MESSAGE);
        break;

      default:
        // Other pages or unknown - remain in current state and log
        this.addLog('info', `Waiting on page: ${page}`);
        break;
    }
  }

  private async handleDocumentUploadStage() {
    if (!this.activeProfile) return;

    this.addLog('info', 'Initiating sequential document uploads...');
    const allDocs = await documentRepository.getDocumentsByProfileId(this.activeProfile.id);

    if (allDocs.length === 0) {
      this.setState('ERROR', 'No stored documents found for this profile.');
      return;
    }

    // Filter out already uploaded documents to prevent re-upload on resume
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
