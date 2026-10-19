export type WorkflowState =
  | 'IDLE'
  | 'PROFILE_SELECTED'
  | 'LOGIN_READY'
  | 'WAITING_FOR_USER_AUTHENTICATION'
  | 'DOCUMENT_UPLOAD'
  | 'CENTRE_SELECTION'
  | 'APPOINTMENT_SELECTION'
  | 'PAYMENT_HANDOFF'
  | 'COMPLETED'
  | 'PAUSED'
  | 'ERROR'
  | 'STOPPED';

export type IvacPageType =
  | 'UNKNOWN'
  | 'LOGIN'
  | 'OTP_VERIFICATION'
  | 'APPLICANT_DETAILS'
  | 'DOCUMENT_UPLOAD'
  | 'CENTRE_SELECTION'
  | 'APPOINTMENT_CALENDAR'
  | 'PAYMENT';

export interface WorkflowStepInfo {
  index: number;
  total: number;
  title: string;
  description: string;
  state: WorkflowState;
}

export interface WorkflowSession {
  state: WorkflowState;
  previousState?: WorkflowState;
  activeProfileId: string | null;
  detectedPage: IvacPageType;
  currentDocumentIndex: number; // 0 for primary, 1.. for additional
  uploadedDocumentIds: string[];
  errorMessage: string | null;
  pausedReason?: string;
  isPaused: boolean;
  logs: WorkflowLogEntry[];
}

export interface WorkflowLogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  page?: IvacPageType;
}
