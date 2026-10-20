export type WorkflowState =
  | 'IDLE'
  | 'PROFILE_SELECTED'
  | 'LOGIN_READY'
  | 'WAITING_FOR_CAPTCHA'
  | 'LOGIN_SUBMISSION_PENDING'
  | 'OTP_REQUEST_PENDING'
  | 'WAITING_FOR_OTP'
  | 'OTP_SUBMISSION_PENDING'
  | 'AUTHENTICATION_PENDING'
  | 'WAITING_FOR_USER_AUTHENTICATION'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_UPLOAD_VERIFICATION'
  | 'WAITING_FOR_DOCUMENT_CONFIRMATION'
  | 'DETAILS_CONFIRMATION_MODAL'
  | 'SAVE_AND_CONTINUE_PENDING'
  | 'POST_CONFIRMATION'
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

export type AuthSubStatus =
  | 'idle'
  | 'awaiting_captcha'
  | 'login_submission_pending'
  | 'otp_request_pending'
  | 'awaiting_otp'
  | 'submitting_otp'
  | 'authentication_pending'
  | 'authenticated'
  | 'auth_failed';

export interface OtpSessionState {
  isRequired: boolean;
  isSubmitting: boolean;
  errorMessage?: string;
  lastSubmittedOtp?: string;
}

export interface CaptchaSessionState {
  isRequired: boolean;
  canVerifyAutomatically: boolean;
  isSolved: boolean;
  manualSubmissionRequired: boolean;
  message?: string;
}

export interface DocumentConfirmationDetails {
  heading?: string;
  description?: string;
  isModalVisible: boolean;
  canConfirm: boolean;
}

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
  authStatus: AuthSubStatus;
  otpState: OtpSessionState;
  captchaState?: CaptchaSessionState;
  confirmationDetails?: DocumentConfirmationDetails;
  logs: WorkflowLogEntry[];
}

export interface WorkflowLogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  page?: IvacPageType;
}
